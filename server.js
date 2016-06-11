var express = require('express');
var app = express();

app.get('/', function(req, res){
  res.send('288788364');
});

app.listen(process.env.PORT);
