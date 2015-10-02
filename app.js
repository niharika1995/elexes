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

var TokenStorage = Parse.Object.extend("Tokens");
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
  var currentUser = Parse.User.current();
  if(currentUser) {
    return response.redirect('/dashboard');
  }
  else {
    return response.render('index', {
      'title': 'Home Page',
      'user': false
    });
  }
});

app.get('/authorize', function(request, response) {
  auth_url = 'https://accounts.google.com/o/oauth2/auth' + '?' + querystring.stringify({
    'scope': scopes.join(' '),
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
      'grant_type': 'authorization_code'
    }
  }, function(tokenErr, tokenResponse, tokenBody) {
    if (!tokenErr && tokenResponse.statusCode == 200) {
      var token = JSON.parse(tokenBody);

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
            useMasterKey: true,
            success: function(user) {
              if(user === undefined) {
                console.log('New user signup');
                var user = new Parse.User();
                var email = person.emails[0].value;
                user.set('username', email);
                user.set('password', Math.random().toString(36).substring(8));
                user.set('email', email);
                user.set('firstName', person.name['givenName']);
                user.set('lastName', person.name['familyName']);
                user.set('companyDomain', email.replace(/.*@/, ""));
                user.set('photo', person.image.url);
                user.signUp(null, {
                  useMasterKey: true,
                  success: function(user) {
                    console.log('User signed up');
                    console.log(user.getSessionToken());
                    var ts = new TokenStorage();
                    ts.set('accessToken', token.access_token);
                    ts.set('refreshToken', token.refresh_token)
                    ts.set('user', user);
                    ts.setACL(restrictedAcl);
                    ts.save(null, {
                      useMasterKey: true,
                      success: function(ts) {
                        console.log('Token saved', ts);
                      },
                      error: function(ts, error) {
                        console.log('Token save failed', ts, error);
                      }
                    });
                    Parse.User.become(user.getSessionToken()).then(function (user) {
                      return response.redirect('/dashboard');
                    },
                    function (error) {
                      console.log('Login with Google Failed.');
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
                console.log('Existing user login', JSON.stringify(user));
                // Update the accessToken if it is different.
                var ts_query = new Parse.Query(TokenStorage);
                ts_query.equalTo('user', user);
                ts_query.first( {useMasterKey: true } ).then(function(ts) {
                  if (ts.get('accessToken') !== token.access_token) {
                    ts.set('accessToken', token.access_token);
                  }
                  if (ts.get('refreshToken') !== token.refresh_token) {
                    ts.set('refreshToken', token.refresh_token);
                  }
                  ts.save(null, { useMasterKey: true });
                }, function(error) {
                  console.log('Error getting token', error);
                  response.send(error);
                });
                var pswd = Math.random().toString(36).substring(8);
                user.setPassword(pswd);
                user.save(null, { useMasterKey: true }).then(function (user) {
                  Parse.User.logIn(user.get('email'), pswd, {
                    useMasterKey: true,
                    success: function(user) {
                      return response.redirect('/dashboard');
                    },
                    error: function(error) {
                      console.log('Error logging in ' + error);
                      return response.send(error);
                    }
                  });
                });
              }
            },
            error: function(error) {
              console.log("Error fetching user query");
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
    if(currentUser.get('domainAdmin')) {
      // Administrator
      var query = new Parse.Query('Initiations');
      query.equalTo('status', false);
      var initiatorQuery = new Parse.Query(Parse.User);
      console.log('match initiator to be of ', currentUser.get('companyDomain'));
      initiatorQuery.equalTo('companyDomain', currentUser.get('companyDomain'));
      query.matchesQuery('initiator', initiatorQuery);
      query.find({
        success: function(initiations) {
          console.log('initiaitions to be approved', initiations);
          return response.render('admin', {
            'title': 'Administration',
            'user': true,
            'photo': currentUser.get('photo'),
            'initiations': initiations
          });
        },
        error: function(error) {
          console.log('Error getting initiations', error);
          return response.render('admin', {
            'title': 'Administration',
            'user': true,
            'photo': currentUser.get('photo'),
            'initiations': []
          });
        }
      });
    }
    // Reviewer/Initiator
    return response.render('dashboard', {
      'title': 'Dashboard',
      'user': true,
      'photo': currentUser.get('photo')
    });
  }
  else {
    return response.redirect('/');
  }
});

app.get('/logout', function(request, response) {
  var currentUser = Parse.User.current();
  if(currentUser) {
    Parse.User.logOut();
  }
  return response.redirect('/');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
