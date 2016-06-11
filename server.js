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
  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      console.log(JSON.stringify(pageEntry.messaging));
      var length = pageEntry.messaging.length;

      receivedMessage(pageEntry.messaging[length-1]);
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#received_message
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  var text = message.text;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  // console.log(JSON.stringify(message));
  var json = {recipient: {
    id: recipientID
  },
  message: {
    text: text
  }};

  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: process.env.PAGE_ACCESS_TOKEN,
    method: 'POST',
    json: json
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });

  // var messageId = message.mid;
  //
  // // You may get a text or attachment but not both
  // var messageText = message.text;
  // var messageAttachments = message.attachments;

}

app.listen(process.env.PORT);
