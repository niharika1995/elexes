var express = require('express');
var path = require('path');
var Parse = require('parse/node');
var Request = require('request');
var querystring = require('querystring')

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

var scopes = [
  'https://www.googleapis.com/auth/plus.me',
  'https://www.googleapis.com/auth/drive'
];

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('index');
});

app.get('/authorize', function(request, response) {
  auth_url = 'https://accounts.google.com/o/oauth2/auth' + '?' + querystring.stringify({
    'scope': scopes[0] + ' ' + scopes[1],
    'response_type': 'code',
    'client_id': CLIENT_ID,
    'access_type': 'offline',
    'approval_prompt': 'force',
    'redirect_uri': REDIRECT_URL
  });
  response.redirect(auth_url);
});

app.get('/oauthCallback', function(request, response) {
  if(request.query && request.query['code']) {
    var code = request.query.code;
  }
  else {
    return response.redirect(401, '/');
  }
  Request.post({
    url:'https://www.googleapis.com/oauth2/v3/token',
    form: {
      'code': code,
      'client_id': CLIENT_ID,
      'client_secret': CLIENT_SECRET,
      'redirect_uri': REDIRECT_URL,
      'access_type': 'offline',
      'grant_type': 'authorization_code'
    }
  }, function(err, httpResponse, body) {
    if (!err && httpResponse.statusCode == 200) {
      console.log(httpResponse.statusCode);
      var token = JSON.parse(body);
      return response.send(token);
    }
    else {
      console.log(err);
      return response.send(err);
    }
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
