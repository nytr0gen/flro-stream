#!/usr/bin/env node
var request = require('request');
var prompt = require('prompt');
var fs = require('fs');
var cheerio = require('cheerio');
var FileCookieStore = require('tough-cookie-filestore');
var exec = require('child_process').exec;

if (!fs.existsSync('cookies.json')) {
    fs.writeFileSync('cookies.json', '');
}

var j = request.jar(new FileCookieStore('cookies.json'));
request = request.defaults({
    jar: j,
    gzip: true,
    headers: {
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Origin': 'http://filelist.ro',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.8,ro;q=0.6'
    }
});

var ask_cmd = function() {
    prompt.start();
    prompt.get(['cmd'], function (err, result) {
        if (err) {
            console.error(err);
            return;
        }

        var cmd = result.cmd.split(' ');
        switch (cmd[0]) {
            case 'check-login': case 'check': case 'c':
                check_login();
                break;
            case 'login': case 'l':
                ask_login();
                break;
            case 'search': case 's':
                search(cmd.slice(1).join(' '));
                break;
            case 'download': case 'd':
                download(cmd[1]);
                break;
            case 'play': case 'p':
                play();
                break;
            case 'quit': case 'q':
                break;
            default:
                console.log('That is no command of mine');
                ask_cmd();
        }
    });
}

var check_login = function() {
    request('http://filelist.ro/my.php', function(err, response, body) {
        if ('/login.php' == response.request.uri.path) {
            console.log('Not logged in');
        } else {
            console.log('Logged in');
        }

        ask_cmd();
    });
};

var ask_login = function() {
    var schema = {
        properties: {
            username: {required: true},
            password: {hidden: true}
        }
    };

    prompt.start();
    prompt.get(schema, function (err, result) {
        login(result.username, result.password);
    });
};

var login = function(usr, pwd) {
    request.post({
        url: 'http://filelist.ro/takelogin.php',
        headers: {
            'Referer': 'http://filelist.ro/login.php'
        },
        form: {
            username: usr,
            password: pwd,
            unlock: '1'
        }
    }, function(err, response, body) {
        if (body == '') {
            console.log('Logged in');
        } else {
            console.log('Not logged in');
        }

        ask_cmd();
    });
};

var torrents;
var search = function(query) {
    request({
        url: 'http://filelist.ro/browse.php',
        headers: {
            'Referer': 'http://filelist.ro/browse.php'
        },
        qs: {
            search: query,
            cat: 0,
            searchin: 0,
            sort: 0
        }
    }, function(err, response, body) {
        var $ = cheerio.load(body);
        torrents = [];
        $('.torrentrow').each(function(key, item) {
            var cat   = $('.torrenttable:nth-child(1) img', item).attr('alt');
            var title = $('.torrenttable:nth-child(2) a', item).attr('title');
            var date  = $('.torrenttable:nth-child(6) .small', item).html().split('<br>')[1];
            var size  = $('.torrenttable:nth-child(7)', item).text();
            var seed  = $('.torrenttable:nth-child(9)', item).text();
            var peer  = $('.torrenttable:nth-child(10)', item).text();

            key++;
            console.log(key + '. ' + title);
            console.log('> ' + cat + ' | ' + size + ' | ' + date + ' | ' + seed + '/' + peer);

            var path = $('.torrenttable:nth-child(3) a', item).attr('href');
            torrents.push({
                title: title,
                url: 'http://filelist.ro/' + path
            });
        });

        ask_cmd();
    });
};

var download = function(key) {
    key--;
    var file = fs.createWriteStream('movie.torrent');
    request(torrents[key].url)
        .on('end', function() {
            console.log(torrents[key].title + ' downloading was successful as movie.torrent');
            console.log('peerflix movie.torrent -v -- --fullscreen');

            ask_cmd();
        })
        .on('error', function(err) {
            console.err(torrents[key].title + ' downloading has failed');
            console.err('Please try again');
            console.err(err);

            ask_cmd();
        })
        .pipe(file);
};

var play = function() {
    var cmd = 'peerflix movie.torrent -v -- --fullscreen';
    exec(cmd, function(error, stdout, stderr) {
        console.log(error, stdout, stderr);
        ask_cmd();
    });
}

ask_cmd();
