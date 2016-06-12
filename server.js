var express = require('express');
var app = express();
var bodyparser = require('body-parser');
var request = require('request');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var user = process.env.USER;
var pass = process.env.PASS;

mongoose.connect('mongodb://'+user+':'+pass+'@ds013414.mlab.com:13414/barsbychickenloaft');
var db = mongoose.connection;

db.once('open', function() {
  var nounSchema = Schema({
    name: String,
    category: String
  });
  //
  // var verbs = Schema({
  //   value:String,
  //   type:String
  // });
  //
  // var adjectives = Schema({
  //   value:String,
  //   type:String
  // });

  var nouns = mongoose.model('nouns', nounSchema);
  // var verb = mongoose.model('Verb', verbs);
  // var adjective = mongoose.model('Adjective', adjectives);
});


function display_results(results) {
  for (i=0;i<results.length-1;i++) {
    res.send(results[i].value);
  }
}

app.use(bodyparser.json());

app.get('/', function(req, res){
  res.send('hello world');
  noun.find({type:'foods'}, display_results);
});

app.get('/webhook', function(req, res){
  if(req.query['hub.verify_token'] === process.env.VERIFY_TOKEN){
    res.send(req.query['hub.challenge']);
  }
  res.send('error');
});

app.post('/webhook', function (req, res) {
  var data = req.body;
  // Make sure this is a page subscr.iption
  if (data.object == 'page') {
    // console.log('Data Entry: '+JSON.stringify(data.entry));
    var entry = data.entry[data.entry.length-1];
    console.log('Messaging: '+JSON.stringify(entry.messaging));
    receivedMessage(entry.messaging[entry.messaging.length-1]);

    res.sendStatus(200);
  }
});

var getRhyme = function(senderID, word, callback) {
  request({
    uri: 'https://api.datamuse.com/words',
    qs:{rel_rhy: word},
    method: 'GET',
    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        // Check to make sure there are rhymes to the last word
        if(body !== undefined && body !== null && body !== '[]'){
          var json = JSON.parse(body);
          callback(senderID, json[Math.floor(Math.random()*(json.length-1))].word);
        }
      } else {
        console.error("Unable to get rhyme.");
        console.error(response);
        console.error(error);
      }
    });
}

// Callback function when rhyme has been retrieved
var sendRhymeToUser = function(senderID, rhyme) {
  console.log('rhyme: ' + rhyme);

  var json = {
    recipient: { id: senderID },
    message: { text: rhyme }
  }

  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
    method: 'POST',
    json: json
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("Successfully sent rhyme to user");
    } else {
      console.error("Unable to send message.");
    }
  });
};

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  if (message && message.text) {
    var messageText = message.text;
    var stringArray = messageText.split(" ");
    var lastWord = stringArray[stringArray.length-1];

    console.log("Received message for user %d and page %d at %d with message: "+messageText,
    senderID, recipientID, timeOfMessage);

    // This will get rhyme from datamuse and call callback sendRhymeToUser
    getRhyme(senderID, lastWord, sendRhymeToUser);
  } else {
    console.error('damn dawg');
  }
}

app.listen(process.env.PORT);
