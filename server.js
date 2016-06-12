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
var nounSchema, verbSchema, adjectiveSchema, categoriesCompareSchema;
var nouns, verbs, adjectives, categoriesCompare;
var food, animal, sport;

db.once('open', function() {
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

  // assign a function to the "methods" object of our animalSchema
  nounSchema.methods.findSimilarTypes = function (cb) {
    return this.model('nouns').find({ type: this.type }, cb);
  };
  verbSchema.methods.findSimilarTypes = function (cb) {
    return this.model('verbs').find({ type: this.type}, cb);
  };
  adjectiveSchema.methods.getAll = function (cb) {
    return this.model('adjectives').find({}, cb);
  }

  // assign a function to the "methods" object of our animalSchema
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
    console.log('Messaging: '+JSON.stringify(entry.messaging));
    receivedMessage(entry.messaging[entry.messaging.length-1]);

    res.sendStatus(200);
  }
});

var getWordType = function(word, callback){
  // assign a function to the "methods" object of our animalSchema
  console.log('before find '+ word);
  categoriesCompare.findByName(word, function (err, categoryFound) {
    if(err) {
      console.log('getWordType failed categoryFound set to null');
      callback('null');
    }
    console.log('detected category: '+ categoryFound);
    console.log('typeof category: '+ typeof categoryFound);
    callback(categoryFound[0].type);
  });

};

//
var spitLine = function(lineLength, cb){
  // Pick at random which line from our preset templates to use
  var instance = new templates({length: lineLength});

  instance.findLength(function (err, sentences) {
    // console.log(JSON.stringify(sentences));

    var rannum = Math.floor(Math.random()*(sentences.length-1));
    sentence = sentences[rannum];
    // console.log('Sentence: '+ JSON.stringify(sentence));

    cb(sentence);
  });

}

var getRhyme = function(senderID, word, category, callback) {

    request({
      uri: 'https://api.datamuse.com/words',
      qs:{rel_rhy: word},
      method: 'GET',
      }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          // Check to make sure there are rhymes to the last word
          if(body !== undefined && body !== null && body !== '[]'){
            var json = JSON.parse(body);

            callback(senderID, category, json[Math.floor(Math.random()*(json.length-1))].word);
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
  // console.log('rhyme: ' + rhyme);
  var messageText = category + ' ' + rhyme;
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

function fillTemplate(template, category, cb) {
  //pull template from db
  asyncLoop(template.index.length, function(loop) {
    switch(template.text[template.index[loop.iteration()]]) {
      case '0':
        console.log("insert noun");
        var n;
        if(category === 'undefined')
          n = new nouns({})
        else
          n = new nouns({type: category});
        n.findSimilarTypes(function(err, li) {
          // filter here
          var item = li[Math.floor(Math.random() * (li.length - 1))];
          template.text[template.index[loop.iteration()]] = item.name;
          console.log(item);
          loop.next();
        });
        break;
      case '1':
        console.log("insert verb");
        var v;
        if(category === undefined)
          v = new nouns({});
        else
          v= new verbs({type: category});
        v.findSimilarTypes(function(err, li) {
          // filter here
          var item = li[Math.floor(Math.random() * (li.length - 1))];
          template.text[template.index[loop.iteration()]] = item.name;
          console.log(item);
          loop.next();
        });
        break;
      case '2':
        console.log("insert adjective");
        var a = new adjectives();
        a.getAll(function(err, li) {
          var item = li[Math.floor(Math.random() * (li.length - 1))];
          template.text[template.index[loop.iteration()]] = item.name;
          console.log(item);
          loop.next();
        });
        break;
    }
    console.log(loop.iteration());


  },
  function(){console.log('cycle ended');
    cb(template);}
);


//   for(var i =0; i<template.index.length; i++) {
//     switch(template.text[template.index[i]]) {
//       case 0:
//         console.log("insert noun");
//         var n;
//         if(category === 'undefined')
//           n = new nouns({})
//         else
//           n = new nouns({type: category});
//         n.findSimilarTypes(function(err, li) {
//           // filter here
//           var item = li[Math.floor(Math.random() * (li.length - 1))];
//           template.text[template.index[i]] = item.name;
//           console.log(item);
//         });
//         break;
//       case 1:
//         console.log("insert verb");
//         var v;
//         if(category === undefined)
//           v = new nouns({});
//         else
//           v= new verbs({type: category});
//         v.findSimilarTypes(function(err, li) {
//           // filter here
//           var item = li[Math.floor(Math.random() * (li.length - 1))];
//           template.text[template.index[i]] = item.name;
//           console.log(item);
//         });
//         break;
//       case 2:
//         console.log("insert adjective");
//         var a = new adjectives();
//         a.getAll(function(err, li) {
//           var item = li[Math.floor(Math.random() * (li.length - 1))];
//           template.text[template.index[i]] = item.name;
// console.log(item);
//         });
//         break;
//     }
//   }
  // console.log(template);
  // return template;
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
      console.log('Sentence: '+ JSON.stringify(sentence));

      console.log("Received message for user %d and page %d at %d with message: "+messageText,
      senderID, recipientID, timeOfMessage);

      // This will get rhyme from datamuse and call callback sendRhymeToUser
      getWordType(lastWord, function(category){
        fillTemplate(sentence, category, function(template) {
          console.log(template);
          getRhyme(senderID, lastWord, category, sendRhymeToUser);
        });
      });
    });


  } else {
    console.error('damn dawg');
  }
}

app.listen(process.env.PORT);


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
