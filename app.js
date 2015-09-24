var express = require('express');
var path = require('path');
var _ = require('underscore');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var Parse = require('parse/node');

var app = express();

Parse.initialize(
  'pU9Ypc7g1gtZS6hvdnGgFHoNHqBYhD1fABXWzV0U',
  'yZtbJl9o9FsEhDOKRcMJtI2vuWKE2PJq7asuwMsY',
  'uBMOQFUPhGny5frqOHh9nHveLYZHwjpuaCPn4oBn'
);

var TokenStorage = Parse.Object.extend("TokenStorage");
var restrictedAcl = new Parse.ACL();
restrictedAcl.setPublicReadAccess(false);
restrictedAcl.setPublicWriteAccess(false);

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

var CLIENT_ID = '703621348399-tci3q5mvsajmjlhbdmb3510ja8c77mi5.apps.googleusercontent.com';
var CLIENT_SECRET = 'MHcQVB1I0LlWzQgoffnd6rRP';
var REDIRECT_URL = 'https://floating-forest-3059.herokuapp.com/oauthCallback';

var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
var scopes = [
  'https://www.googleapis.com/auth/plus.me',
  'https://www.googleapis.com/auth/drive'
];
var auth_url = oauth2Client.generateAuthUrl({
  scope: scopes
});

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('index');
});

app.get('/authorize', function(request, response) {
  response.redirect(auth_url);
});

app.get('/oauthCallback', function(request, response) {
  var code = request.query.code;
  oauth2Client.getToken(code, function(err, tokens) {
    if(!err) {
      oauth2Client.setCredentials(tokens);
      var token = new TokenStorage();
      token.setACL(restrictedAcl);
      Parse.Cloud.useMasterKey();
      token.save(null, { useMasterKey: true });
      var plus = google.plus('v1');
      plus.people.get({ userId: 'me' });
      var user = new Parse.User();
    }
    return response.send('Error fetching oauth data');
  });
});

// app.get('/oauthCallback2', function(request, response) {
//   Parse.Promise.as().then(function() {
//     /** 
//      * Check if we get an authorization code as parameter.
//      */
//     return request.query.code;
//   }).then(function (code) {
//     /*
//      * Exchange authorization code for an
//      * access token and a refresh token (optional).
//      */
//     return Parse.Promise.as().then(function() {
//       return oauth2Client.getToken(code);
//     }
//   }).then(function(err, tokens) {
//     /*
//      * Process the response from Google.
//      * Save the access token in the client and under TokenStorage class.
//      */
//     oauth2Client.setCredentials(tokens);
//     var token = new TokenStorage();
//     // No public access.
//     token.setACL(restrictedAcl);
//     Parse.Cloud.useMasterKey();
//     return token.save(null, { useMasterKey: true });
//   }).then(function() {
//     /*
//      * Query Google+ profile.
//      */ 
//     var plus = google.plus('v1');
//     return Parse.Promise.as(plus.people.get({ userId: 'me' }));
//   }).then(function() {
//     var user = new Parse.User();
//     user.set({

//     })
//   }, function(error) {
//     // If there's an error storing the request, render the error page.
//     response.send('Failed to save auth request.');
//   });
// });

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
