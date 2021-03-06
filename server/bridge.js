var Model = require('./model.js');
var Ticker = Model.Ticker;
var User = Model.User;
var Room = Model.Room;
var Util = Model.Util;
var Bridge = require('../bridge/lib/bridge.js').Bridge;
var bridge = new Bridge({apiKey:"R+DPnfAq"});
//var bridge=new Bridge({apiKey:"abcdefgh"});
//var bridge = {ready:function(){}}
var Dao = require('./dao.js').Dao;
var dao = new Dao('localhost','root','narsiodeyar1','quizbowl');
var bDao;
var ticker;
var users = {};
var rooms = {};
var roomnames=[];
var LOGOFF_TIME = 30000;
var Message = Model.Message;
var SUCCESS_MESSAGE = new Message("success",null,1337);
bridge.ready(function(){
  console.log("Connected to Bridge");
  ticker= {
    join:function(handler){
      bridge.joinChannel('ticker',handler);
    },
  }
  bDao = {
    "tossup_get":function(pKey, callback) {
      dao.tossup.get(pKey, callback);
    },
    "tossup_search":function(obj, callback){
      dao.tossup.search(obj, function(result){
        callback(result);
      });
    },
    "tossup_search_java":function(obj,callback){
      dao.tossup.search(obj,function(result){
        callback.callback(result);
      });
    }
  }
  var user = {
    login:function(user,callback){
      dao.user.get(user.fbId,function(result) {
      if (result.length == 1){
        login(user, true, function(obj) {
          if (callback) {
            callback(obj);
          }
        });
      } else {
        dao.user.create(user,function(result){
          if (result.status = "success") {
            console.log(result);
            login(user, true, function(obj) {
              if (callback) {
                callback(obj);
              }
            });
          } else {

          }
        });
      }
      });
    },
    logoff:function(user, callback){
      logoff(user,function(obj) {
          if (callback){
        callback(obj);
        }
      });
    },
    alive:function(user, callback){
      users[user.fbId].alive = true;
      if (callback) {
        callback(SUCCESS_MESSAGE);
      }
    }
  }
  var reader = {
    answer:function(user, score, callback) {
      console.log("ANSWERING: "+user);
      if (user.fbId!=null) {
      dao.reader.answer(user,score, function(obj){
          if (obj.action.correct){
          answer(user, score.answer, score.score);
          }
          callback(SUCCESS_MESSAGE);
          });
      }
    }
  }
  multi = {
join:function(user,room,handler,callback){
       if (users[user.fbId] !== undefined) {
       if (roomnames.indexOf(room)!=-1){
       } else {
         roomnames.push(room);
         rooms.room = new Room(room,room.password,handler);
         bridge.joinChannel(room,
             {
              chat:function(name,message){
                console.log("["+room+"] "+name+": "+message);
              } 
             }
         );
       }
       rooms.room.join(users[user.fbId],room.password,function(obj){
         if (obj.joined) {
           bridge.joinChannel(room, handler, callback);
           users[user.fbId].handler = handler;
           console.log(users[user.fbId].username+" joined ["+room+"]");
         }  
       });
       } else {
         callback(new Message("failure","user must be logged in",200));
       }
     },
    leave:function(user){
        room = users[user.fbId].room.name;
        if (roomnames.indexOf(room)==-1){
        } else {
          rooms.room.leave(users[user.fbId],function(){});
          if (rooms.room.users.length ==0){
            delete rooms.room;
            roomnames.pop(room); 
          }
        }
        bridge.leaveChannel(room,users[user.fbId].handler,function(){
            });
        users[user.fbId].handler=null;
      },
getRooms:function(callback){
           callback(rooms);
         }
  }
  tickerHandler = {
push:function(ticker){
       console.log(ticker.user.username+" "+ticker.text);
     },
users:function(users){
        console.log(users);
      }
  }
  bridge.joinChannel("ticker", tickerHandler, function(channel){ticker = channel;console.log("joined ticker");});
  bridge.publishService("dao",bDao);
  bridge.publishService("user",user);
  bridge.publishService("reader",reader);
  bridge.publishService("multi",multi);
  bridge.publishService("ticker",ticker);
  console.log("published dao");
  setInterval(function(){
      console.log("Garbage collection of users:");
      for (var i in users) {
      console.log("Checking if alive still: "+users[i].username+" - "+users[i].alive);

      if (users[i].alive){
      users[i].alive = false;
      } else {
      logoff({username:users[i].username,fbId:users[i].fbId});
      }
      }
      },LOGOFF_TIME);
});
answer = function(user, answer, score) {
  console.log(arguments);
  ticker.push(new Ticker(user, "answered <i>"+answer+"</i> with a score of "+score));
}
login = function(user, loggedIn, callback) {
  if (loggedIn) {
    if (!users[user.fbId]) {
      users[user.fbId] = new User(user.username,user.email,user.fbId);
      ticker.push(new Ticker(user, "<br/>logged in"));
      ticker.users(users);
      callback(SUCCESS_MESSAGE);
    } else {
      callback(new Message("failure","already logged in",100));
    }
  } else {
    callback(new Message("failure",null,201));
  }
}
logoff = function(user, callback) {
  if (users[user.fbId]){
    console.log(user);
    delete users[user.fbId];
    ticker.push(new Ticker(user, "<br/>logged off"));
    ticker.users(users);
    if (callback) {
      callback(SUCCESS_MESSAGE);
    }
  } else{ 
    if (callback) {
      callback(new Message("success","already logged out",100));
    }
  }
}
