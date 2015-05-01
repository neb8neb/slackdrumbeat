var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var dotenv = require('dotenv');
var SpotifyWebApi = require('spotify-web-api-node');

dotenv.load();

var spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_KEY,
    clientSecret: process.env.SPOTIFY_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', function (req, res) {
    if (spotifyApi.getAccessToken()) {
        return res.send('You are logged in.');
    }
    return res.send('<a href="/authorize">Authorize Spotify Account</a>');
});

app.get('/authorize', function (req, res) {
    var scopes = ['playlist-modify-public', 'playlist-modify-private'];
    var state = new Date().getTime();
    var authoriseURL = spotifyApi.createAuthorizeURL(scopes, state);
    res.redirect(authoriseURL);
});

app.get('/callback', function (req, res) {
    spotifyApi.authorizationCodeGrant(req.query.code)
        .then(function (data) {
            spotifyApi.setAccessToken(data.body['access_token']);
            spotifyApi.setRefreshToken(data.body['refresh_token']);
            return res.redirect('/');
        }, function (err) {
            return res.send(err);
        });
});

app.use('/store', function (req, res, next) {
    if (req.body.token !== process.env.SLACK_TOKEN) {
        return res.status(500).send('Cross site request forgerizzle!');
    }
    next();
});

app.post('/store', function (req, res) {
    spotifyApi.refreshAccessToken()
        .then(function (data) {
            spotifyApi.searchTracks(req.body.text)
                .then(function (data) {
                    var results = data.body.tracks.items;
                    if (results.length === 0) {
                        return res.send('Could not find that track.');
                    }
                    var track = results[0];
                    console.log(track);
                    var trackId = results[0].id;
                    spotifyApi.addTracksToPlaylist(process.env.SPOTIFY_USERNAME, process.env.SPOTIFY_PLAYLIST_ID, ['spotify:track:' + trackId])
                        .then(function (data) {

                            //console.log(data);
                            //var options = {
                            //    host: 'hooks.slack.com',
                            //    path: process.env.SLACK_WEBHOOK_URL,
                            //    port: 80,
                            //    method: 'POST'
                            //}
                            //var req = http.request(options, function(res) {
                            //    console.log('Status: ' + res.statusCode);
                            //    console.log('Headers: ' + JSON.stringify(res.headers));
                            //    res.setEncoding('utf8');
                            //    res.on('data', function (chunk) {
                            //        console.log('Response: ' + chunk);
                            //    });
                            //});
                            //req.on('error', function(e) {
                            //    console.log('problem with request: ' + e.message);
                            //});
                            //req.write('"text": "Track added to playlist."}')
                            //req.end();
                            request.post(process.env.SLACK_WEBHOOK_URL).form({text: 'Track added to playlist.'});

                            return res.send('Track added!');
                        }, function (err) {
                            return res.send(err.message);
                        });
                }, function (err) {
                    return res.send(err.message);
                });
        }, function (err) {
            return res.send('Could not refresh access token, you probably need to auth yourself again.');
        });
});

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));
