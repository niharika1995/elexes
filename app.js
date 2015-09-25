var express = require('express');
var path = require('path');
var Parse = require('parse/node');
var Request = require('request');
var querystring = require('querystring')
var moment = require('moment');

var app = express();

Parse.initialize(
  'pU9Ypc7g1gtZS6hvdnGgFHoNHqBYhD1fABXWzV0U',
  'yZtbJl9o9FsEhDOKRcMJtI2vuWKE2PJq7asuwMsY',
  'uBMOQFUPhGny5frqOHh9nHveLYZHwjpuaCPn4oBn'
);
Parse.User.enableUnsafeCurrentUser()

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
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive'
];

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('index');
});

app.get('/authorize', function(request, response) {
  auth_url = 'https://accounts.google.com/o/oauth2/auth' + '?' + querystring.stringify({
    'scope': scopes.join(' '),
    'response_type': 'code',
    'client_id': CLIENT_ID,
    'access_type': 'offline',
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
      'grant_type': 'authorization_code'
    }
  }, function(tokenErr, tokenResponse, tokenBody) {
    if (!tokenErr && tokenResponse.statusCode == 200) {
      var token = JSON.parse(tokenBody);
      console.log(token);
      Request.get({
        url: 'https://www.googleapis.com/plus/v1/people/me',
        headers: {
          'Authorization': 'Bearer ' + token.access_token
        }
      }, function(personErr, personResponse, personBody) {
        if (!personErr && personResponse.statusCode == 200) {
          var person = JSON.parse(personBody);
          var query = new Parse.Query(Parse.User);
          query.equalTo("email", person.emails[0].value);
          query.first({
            success: function(user) {
              if(user === undefined) {
                // New user
                console.log('New user signup');
                var user = new Parse.User();
                var email = person.emails[0].value;
                user.set('username', email);
                user.set('password', Math.random().toString(36).substring(8));
                user.set('email', email);
                user.set('firstName', person.name['givenName']);
                user.set('lastName', person.name['familyName']);
                user.set('companyDomain', email.replace(/.*@/, ""));
                user.set('authData', {
                  'google': {
                    'id': person.id,
                    'access_token': token.access_token,
                    'expiration_date': new moment().add(60, 'h').format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z'
                  }
                });
                user.signUp(null, {
                  success: function(user) {
                    console.log('User signed up');
                    Parse.User.become(user.getSessionToken).then(function (user) {
                        return response.redirect('/dashboard');
                      },
                      function (error) {
                        console.log('Login with GitHub Failed.');
                        return response.redirect('/');
                      });
                  },
                  error: function(user, error) {
                    console.log('Error signing up user');
                    return response.send(error);
                  }
                });
              }
              else {
                //Existing user
                return response.send('Existing user');
              }
            },
            error: function(error) {
              console.log("Fetching user query");
              return response.send(error);
            }
          });
        }
        else {
          console.log(personErr);
          return response.send(personResponse);
        }
      });
    }
    else {
      console.log(tokenErr);
      return response.send(tokenErr);
    }
  });
});

app.get('/dashboard', function(request, response) {
  var currentUser = Parse.User.current();
  if(currentUser) {
    return response.render('dashboard', {
      'user': currentUser.getUsername()
    });
  }
  else {
    return response.redirect('/');
  }
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
