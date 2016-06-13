var express = require('express');
var app = express();
var bodyparser = require('body-parser');
var request = require('request');
var mongoose = require('mongoose');

var user = process.env.USER;
var pass = process.env.PASS;

// DATABASE SECTION:
// Connect to the MongoLab Database
// Define the model  that will be used throughout the bot to get specific
mongoose.connect('mongodb://'+user+':'+pass+'@ds013414.mlab.com:13414/barsbychickenloaft');
var db = mongoose.connection;
var Schema = mongoose.Schema;
var nounSchema, verbSchema, adjectiveSchema, categoriesCompareSchema;
var nouns, verbs, adjectives, categoriesCompare;
var food, animal, sport;

db.once('open', function() {
  // Define the Schemas that are used
  categoriesCompareSchema = new Schema({
    name: String,
    type: String
  });
  categoriesCompareSchema.set('collection', 'categoriesCompare');
  nounSchema = new Schema({
    name: String,
    type: String
  });
  verbSchema = new Schema({
    name: String,
    type: String
  });
  adjectiveSchema = new Schema({
    name: String
  });
  templateSchema = new Schema({
    length: Number,
    index: Array,
    text: Array
  });

  // assign a function to the "methods" object of our schemes to enable custom queries
  nounSchema.methods.findSimilarTypes = function (cb) {
    return this.model('nouns').find({ type: this.type }, cb);
  };
  nounSchema.methods.getAll = function (cb) {
    return this.model('nouns').find({}, cb);
  }
  verbSchema.methods.findSimilarTypes = function (cb) {
    return this.model('verbs').find({ type: this.type}, cb);
  };
  verbSchema.methods.getAll = function (cb) {
    return this.model('verbs').find({}, cb);
  }
  adjectiveSchema.methods.getAll = function (cb) {
    return this.model('adjectives').find({}, cb);
  }
  categoriesCompareSchema.methods.findSimilarNames = function (cb) {
    return this.model('categoriesCompare').find({ name: this.name }, cb);
  }
  categoriesCompareSchema.statics.findByName = function (name, cb) {
    return this.find({ name: new RegExp(name, 'i') }, cb);
  };
  templateSchema.methods.findLength = function(cb) {
    return this.model('templates').find({ length: this.length }, cb);
  }

  verbs = mongoose.model('verbs', verbSchema);
  adjectives = mongoose.model('adjectives', adjectiveSchema);
  nouns = mongoose.model('nouns', nounSchema);
  categoriesCompare = mongoose.model('categoriesCompare', categoriesCompareSchema);
  templates = mongoose.model('templates', templateSchema);
});

// APP SECTION
app.use(bodyparser.json());

app.get('/', function(req, res){
  res.send('hello world');
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
    if(JSON.stringify(entry.messaging[entry.messaging.length-1].message) !== 'undefined'){
      console.log('messaging received: ' + JSON.stringify(entry.messaging[entry.messaging.length-1].message));
      receivedMessage(entry.messaging[entry.messaging.length-1]);
    }else
      console.log('error');

      res.sendStatus(200);
  }
});

// CONTROLLER/LOGIC SECTION
// This classifies the last word retrieved from the user's bar into different
// categories to be used.
var getWordType = function(word, callback){
  categoriesCompare.findByName(word, function (err, categoryFound) {
    if(err) {
      console.log('get word type failed');
      callback('null');
    }
    // var category = category === 'sports' ? 'sport':category;
    var category;
    if(categoryFound[0] !== undefined)
      category =  categoryFound[0].type;
    else
      category = 'undefined';
    console.log('detected category: '+ category);
    callback(category);
  });
};

// This determines from the templates which line from our preset templates
// according to the number of words our bar should contain to use
var spitLine = function(lineLength, cb){
  var instance = new templates({length: lineLength});
  instance.findLength(function (err, sentences) {
    var randNum = Math.floor(Math.random()*(sentences.length-1));
    var sentence = sentences[randNum];
    // console.log('sentence: '+ JSON.stringify(sentence.text));
    cb(sentence);
  });
}

var getRhyme = function(senderID, word, category, template, callback) {

    request({
      uri: 'https://api.datamuse.com/words',
      qs:{rel_rhy: word},
      method: 'GET',
      }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          // Check to make sure there are rhymes to the last word
          if(body !== undefined && body !== null && body !== '[]'){
            var json = JSON.parse(body);
            var word = json[Math.floor(Math.random()*(json.length-1))].word;

            template.text.push(word);
            var bar = template.text.join(' ');


            callback(senderID, category, bar);
          }
          else {
            sendRhymeToUser(senderID, category, "Sorry, something went wrong somewhere");
          }
        } else {
          console.error("Unable to get rhyme.");
          console.error(response);
          console.error(error);
        }
      });

}

// Callback function when rhyme has been retrieved
var sendRhymeToUser = function(senderID, category, rhyme) {
  var messageText = rhyme;
  console.log('at sendRhymeToUser '+ category);
  var json = {
    recipient: { id: senderID },
    message: { text: messageText }
  };

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

// Fill the template's index's that need to be replaced
// i) 0 = noun, 1 = verb, 2 = adjective
function fillTemplate(template, category, cb) {
  //pull template from db
  if(template !== undefined){
    asyncLoop(template.index.length, function(loop) {
      switch(template.text[template.index[loop.iteration()]]) {
        case '0':
          console.log("insert noun");
          var n;
          if(category === 'undefined'){
            n = new nouns({})
            n.getAll(function(err, li) {
              // filter here
              var item = li[Math.floor(Math.random() * li.length )];
              console.log('item' + item);
              template.text[template.index[loop.iteration()]] = item.name;
              loop.next();
            });
          } else {
            n = new nouns({type: category});
            n.findSimilarTypes(function(err, li) {
              // filter here
              var item = li[Math.floor(Math.random() * li.length )];
              console.log('list of item' + JSON.stringify(li));
              console.log('item' + item);
              template.text[template.index[loop.iteration()]] = item.name;
              loop.next();
            });
          }
          break;
        case '1':
          console.log("insert verb");
          var v;
          if(category === 'undefined') {
            v = new verbs({});
            v.getAll(function(err, li) {
              // filter here
              var item = li[Math.floor(Math.random() * li.length )];
              console.log('item' + item);
              template.text[template.index[loop.iteration()]] = item.name;
              loop.next();
            });
          } else {
            v= new verbs({type: category});
            v.findSimilarTypes(function(err, li) {
              // filter here
              var item = li[Math.floor(Math.random() * li.length )];
              console.log('list of item' + JSON.stringify(li));
              console.log('item' + item);
              template.text[template.index[loop.iteration()]] = item.name;
              loop.next();
            });
          }
          break;
        case '2':
          console.log("insert adjective");
          var a = new adjectives();
          a.getAll(function(err, li) {
            var item = li[Math.floor(Math.random() * li.length )];
            console.log('list of item' + li);
            console.log('item' + item);
            template.text[template.index[loop.iteration()]] = item.name;
            loop.next();
          });
          break;
      }
      console.log('current iteration: ' + loop.iteration());

    },
    // Callback function when the Async loop has finished
    // CB function Will be get rhyme
    function(){
      cb(template);}
    );
  else{
    sendRhymeToUser(senderID, category, "Sorry, something went wrong somewhere");
  }
}

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  if (message && message.text) {
    var messageText = message.text;
    var stringArray = messageText.split(" ");
    var lastWord = stringArray[stringArray.length-1];
    var wordCount = stringArray.length-1;

    spitLine(stringArray.length, function (sentence) {
      getWordType(lastWord, function(category){
        fillTemplate(sentence, category, function(template) {
          getRhyme(senderID, lastWord, category, template, sendRhymeToUser);
        });
      });
    });
  } else {
    console.error('damn dawg');
  }
}

app.listen(process.env.PORT);


// Asynchronous Loop is used to ensure the specific requests are handled
function asyncLoop(iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
}
