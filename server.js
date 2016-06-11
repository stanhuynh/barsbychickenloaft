var express = require('express');
var app = express();
var bodyparser = require('body-parser');

app.use(bodyparser.json());

app.get('/', function(req, res){
  res.send('hello world');
});

app.get('/webhook', function(req, res){
  if(req.query['hub.verify_token'] === 'barsbychickenloaft'){
    res.send(req.query['hub.challenge']);
  }
  res.send('error');
});

app.post('/webhook', function (req, res) {
  var data = req.body;
  console.log(data);
  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

app.listen(process.env.PORT);
