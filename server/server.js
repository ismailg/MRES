var config = require(__dirname + '/config');

const express = require('express');
const hbs = require('hbs');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

var agents = require(__dirname + '/utils/agents');

const publicPath = path.join(__dirname, '../public');

var rooms = {};
var ai_agents = [];
var players = [];

const conditions = ['Level1', 'Level2'];
const game_names = ['rps', 'fwg', 'numbers', 'shootout'];

function determine_winner(game, actions) {
  // TODO: this should be in a separate logic for each game
  const [player1, player2] = actions;
  const wps = weapons[game];

  if (game == "rps" || game == "fwg") {
    if (player1.action == player2.action) {
      return null;
    } else if ((player1.action == wps[0] && player2.action == wps[2]) || (player1.action == wps[1] && player2.action == wps[0]) || (player1.action == wps[2] && player2.action == wps[1])) {
      // first action wins
      return player1.id;
    } else {
      // second action wins
      return player2.id;
    }
  } else if (game == "numbers") {
    if (player1.action == player2.action) {
      return null;
    } else if ((player1.action == wps[1] && player2.action == wps[0]) || (player1.action == wps[2] && player2.action == wps[1]) || (player1.action == wps[3] && player2.action == wps[2]) || (player1.action == wps[4] && player2.action == wps[3]) || (player1.action == wps[0] && player2.action == wps[4])) {
      return player1.id;
    } else if ((player2.action == wps[1] && player1.action == wps[0]) || (player2.action == wps[2] && player1.action == wps[1]) || (player2.action == wps[3] && player1.action == wps[2]) || (player2.action == wps[4] && player1.action == wps[3]) || (player2.action == wps[0] && player1.action == wps[4])) {
      return player2.id;
    }
  } else if (game === 'shootout') {
    let player;
    let agent;

    if(player1.agent) {
      agent = player1;
      player = player2;
    } else {
      agent = player2;
      player = player1;
    }

    return (player.action !== agent.action
      ? player
      : agent).id;
  }
}

// function to randomize the elements within an array in place (changes the array)
function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}
// conditions in randomized order
var condition_array = conditions.slice();
shuffleArray(condition_array);

//Randomise Computer Stategy
//var strategies = [nashPlay,lvl1Comp,lvl2Comp];
const weapons = {
  rps: ['rock', 'paper', 'scissors'],
  fwg: ['fire', 'water', 'grass'],
  numbers: ['one', 'two', 'three', 'four', 'five'],
  shootout: ['left', 'center', 'right']
};

// Creating server using Express and initilaising SocketIO
var app = express();
var server = app.listen(process.env.PORT || config.port, function () {
  var port = server.address().port;
  var address = ""
  if (config.local) {
    address += config.local_server + config.path + '/';
  } else {
    address += config.remote_server + config.path + '/';
  }
  console.log("Server running at port %s", port);
  console.log("Server should be available at %s", address);
});

var io = require('socket.io')(server, { path: config.path + '/socket.io' });

// ask HBS we want to use partials
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '/views'));
app.use(config.path, express.static(publicPath));

// 2 args: name of the helper first, then function to run
hbs.registerHelper('getCurrentYear', () => {
  return new Date().getFullYear();
});

hbs.registerHelper('username', () => {
  return username;
});

// construct global.js file with settings from config.js
app.get(config.path + '/js/global.js', function (req, res) {
  res.setHeader('Content-type', 'text/javascript');
  var global_string = 'var _DEBUG = ' + config.debug + '; var _p = ' + config.p + '; '
  if (config.local) {
    global_string += 'var _SERVER_ADDRESS = "' + config.local_server + '"; ';
  } else {
    global_string += 'var _SERVER_ADDRESS = "' + config.remote_server + '"; ';
  }
  global_string += 'var _PATH = "' + config.path + '"; ';
  res.send(global_string);
})

app.get(config.path + '/', (req, res) => {
  res.render('consent.hbs');
});

app.get(config.path + '/experiment', (req, res) => {
  res.render('experiment.hbs');
});

//listen for new connection (client connected to server and do sthg when conection comes in (calback func)
io.on('connection', function (socket) {

  console.log('User  ' + socket.id + '  connected');

  // add socket to players
  if (typeof players[socket.id] == 'undefined') {
    const date = new Date();
    players[socket.id] = {
      'id': socket.id,
      'room': '',
      'condition': '',
      'start': date.toISOString(),
      'end': '',
      'data': {
        'descriptives': {},
        'rps': [],
        'fwg': [],
        'numbers': [],
        'shootout': [],
        'strategy': {}
      },
      'score': {}
    }
  };

  socket.on('join-room', function (data) {
    // an AI player will request to join a specific room in order to fill it up
    // real players should not be able to guess a room id, so this should only
    // work for AI agents, but it it not entirely secure
    // TODO: use some id variable to check that a specific room request came from an AI
    if (typeof data.room_id !== 'undefined') {
      config.debug && console.log("Client %s requesting to join room %s", socket.id, data.room_id);
      // check if room is avaibable
      if (typeof rooms[data.room_id] !== 'undefined') {
        // room exists
        var room = data.room_id; // need this in join-room-reply
        if (rooms[data.room_id].participants() < rooms[data.room_id].players) {
          // room has places left, so socket can join room
          join_room(socket, data.room_id, data);
        }
      }
    } else {
      // assume this is a human
      console.log('Client %s with prolific id %s joined room %s', socket.id, data.prolific_id, room);
      data.participants = config.players; // I don't think this is needed anymore
      var room = find_room(data);
      join_room(socket, room, data);
    }
    if (typeof players[socket.id] !== 'undefined' && typeof rooms[socket.room_id] !== 'undefined') {
      // save any descriptives also in room
      rooms[socket.room_id].data.descriptives[socket.id] = players[socket.id].data.descriptives;
    }




    stepConfig = {};

    var configKey = config.debug ? 'debug' : 'normal';

    if(  typeof(config['game_numRounds']) !== 'undefined'
      && typeof(config['game_numRounds'][configKey]) !== 'undefined'
    ){
      stepConfig = config['game_numRounds'][configKey];
    }

    socket.emit('join-room-reply', {
      session_id: room,
      stepConfig,
      // TODO: should we really provide the condition as a message?
      condition: rooms[socket.room_id].condition
    });
  });

  // this message is called from client after filling in the first form
  socket.on('send-user-data', function (data) {
    try {
      config.debug && console.log("received user data %s", data);

      const descriptives = {
        'prolific_id': data.id
      };

      // save data in players object
      players[socket.id].data.descriptives = descriptives;
      socket.emit('send-user-data-reply', {});
    } catch (err) {
      console.log(err);
    }
  });

  socket.on('start-game-request', function (data) {
    // (human) client can send request to start game
    // TODO: check if game has been played
    try {
      console.log("start-game-request received from %s", socket.id);
      if (game_names.indexOf(data.game) !== -1) {
        rooms[socket.room_id].current_game = data.game;
        rooms[socket.room_id].current_round = 1;
        console.log("set game to %s", rooms[socket.room_id].current_game)
        // initialize score in game to 0
        var clients = io.nsps['/'].adapter.rooms[socket.room_id].sockets;
        for (var c in clients) {
          rooms[socket.room_id].score[c][rooms[socket.room_id].current_game] = 0;
          // players[socket.id].score[rooms[socket.room_id].current_game] = 0;
          players[c].score[rooms[socket.room_id].current_game] = 0;
          //added condition to player's data file
          // players[socket.id].condition = rooms[socket.room_id].condition;
          players[c].condition = rooms[socket.room_id].condition;
        }
        io.in(socket.room_id).emit('start-game', { 'game': rooms[socket.room_id].current_game });
        io.in(socket.room_id).emit('start-round', { 'game': rooms[socket.room_id].current_game, 'round': rooms[socket.room_id].current_round });
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.on('finish-game-request', function (data) {
    // client can send request to finish game
    // TODO: we don't need this; want the server to decide when to end a game
    io.in(socket.room_id).emit('finish-game', { game: data.game });
  });

  // this event takes an action from a (human or computer) user
  // if the number of actions taken is equal to the number of users
  // the outcome of the round is decided
  socket.on('take-action', function (data) {
    try {
      console.log('rooms[socket.room_id].current_game', rooms[socket.room_id].current_game)

      // data should be an object (JSON) format with
      // {(socket) id: , action: , rt: }
      config.debug && console.log('take-action with action %s received from %s', data.action, socket.id);

      // push the action to the players array
      players[socket.id].data[rooms[socket.room_id].current_game].push({ 'round': rooms[socket.room_id].current_round, 'action': data.action, 'rt': data.rt });

      // push the action in the current actions array
      rooms[socket.room_id].current_actions.push({ id: socket.id, action: data.action, rt: data.rt, agent: data.agent });

      // check if everyone acted
      if (rooms[socket.room_id].current_actions.length == rooms[socket.room_id].players) {
        // all actions have been taken
        rooms[socket.room_id].feedback_done = 0;

        config.debug && console.log('all actions received');

        // determine winner (null when a tie)
        var winner = determine_winner(rooms[socket.room_id].current_game, rooms[socket.room_id].current_actions);

        // loop through the players and send a tie, win, or lose response
        var clients = io.nsps['/'].adapter.rooms[socket.room_id].sockets;

        for (var c in clients) {
          // check if client is the first one who responded, otherwise reorder the array
          // TODO: this won't work with games with players > 2
          if (rooms[socket.room_id].current_actions[0].id == c) {
            // player is first who responded
            var current_choices = rooms[socket.room_id].current_actions;
          } else {
            // player wasn't first who responded
            var current_choices = [rooms[socket.room_id].current_actions[1], rooms[socket.room_id].current_actions[0]];
          }

          // check whether client was winner or loser, or whether it was a tie, and send response to client
          if (!winner) {
            io.sockets.in(c).emit('tie', current_choices);

            if (config.debug) {
              console.log("send tie reply to %s with choices %s", c, JSON.stringify(current_choices));
            }
          } else if (winner == c) {
            // players[socket.id].score[rooms[socket.room_id].current_game]++;
            players[c].score[rooms[socket.room_id].current_game]++;
            rooms[socket.room_id].score[c][rooms[socket.room_id].current_game]++;

            io.sockets.in(c).emit('win', current_choices);

            if (config.debug) {
              console.log("send winners reply to %s with choices %s", c, JSON.stringify(current_choices));
            }
          } else {
            // players[socket.id].score[rooms[socket.room_id].current_game]--;
            players[c].score[rooms[socket.room_id].current_game]--;
            rooms[socket.room_id].score[c][rooms[socket.room_id].current_game]--;

            io.sockets.in(c).emit('loss', current_choices);

            if (config.debug) {
              console.log("send losers reply to %s with choices %s", c, JSON.stringify(current_choices));
            }
          }
          console.log(`player ${c} score is ${players[c].score[rooms[socket.room_id].current_game]}`);
        }

        // push the actions to the room data
        rooms[socket.room_id].data[rooms[socket.room_id].current_game].push({ 'round': rooms[socket.room_id].current_round, 'actions': rooms[socket.room_id].current_actions, 'winner': winner });
        // reset actions to empty and increase round nr
        rooms[socket.room_id].current_actions = [];
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.on('feedback-done', function () {
    try {
      rooms[socket.room_id].feedback_done++;
      if (rooms[socket.room_id].feedback_done == rooms[socket.room_id].players) {
        // everyone is ready with feedback;
        // if current_round >= number of trials, finish the game

        var gameName    = rooms[socket.room_id].current_game;
        var roundNumber = rooms[socket.room_id].current_game;
        var configKey   = config.debug ? 'debug' : 'normal';
        var trail       = config.trail;
        var sNextRounds = 0; // Skip Next Rounds

        if(  typeof(config['game_numRounds']) !== 'undefined'
          && typeof(config['game_numRounds'][configKey]) !== 'undefined'
          && typeof(config['game_numRounds'][configKey][gameName]) !== 'undefined'
        ){
          var configObj = config['game_numRounds'][configKey];
          trail         = configObj[gameName];

          var gameArray    = Object.keys(configObj);
          var currentIndex = gameArray.indexOf(gameName);

          for( var i = currentIndex + 1 ; i < gameArray.length; i++){

            loopGameName = gameArray[i];

            if(  typeof(config['game_numRounds'][configKey][loopGameName]) !== 'undefined'
              && config['game_numRounds'][configKey][loopGameName] === 0
            ){
              sNextRounds++;
              continue;
            }
            break;
          }

          // Get Next Round
        }

        if (rooms[socket.room_id].current_round >= trail) {
          var clients = io.nsps['/'].adapter.rooms[socket.room_id].sockets;
          for (var c in clients) {
            const total_score = rooms[socket.room_id].score[c].rps
              + rooms[socket.room_id].score[c].fwg
              + rooms[socket.room_id].score[c].numbers
              + rooms[socket.room_id].score[c].shootout;

            io.sockets.in(c).emit('finish-game', {
              game: rooms[socket.room_id].current_game,
              score: rooms[socket.room_id].score[c][rooms[socket.room_id].current_game],
              total_score,
              sNextRounds
            });
          }
        } else {
          rooms[socket.room_id].current_round++;
          io.in(socket.room_id).emit('start-round', { game: rooms[socket.room_id].current_game, round: rooms[socket.room_id].current_round });
        }
      }
    } catch (err) {
      console.log(err);
    }
  });

  //handle data from debrief about difficulty and confidence as well as comments
  socket.on('insight-questions', function (data) {
    try {
      config.debug && console.log("received feedback data %s", data);
      var insight = {
        'difficulty': data.difficulty,
        'confidence': data.confidence,
        'comments': data.comments
      };
      // save feedback data from player in "players" object
      players[socket.id].data.strategy = insight;

      rooms[socket.room_id].data.strategy[socket.id] = insight;
      config.debug && console.log('insight saved in room %s is %s', socket.room_id, rooms[socket.room_id].data.strategy[socket.id]);
      // TODO: rooms[socket.room_id].descriptives[socket.id] should have already been set when joining room
      rooms[socket.room_id].data.descriptives[socket.id] = players[socket.id].data.descriptives; //{'prolificID': data.prolificID};

      socket.emit('insight-questions-reply', {});
    } catch (err) {
      console.log(err);
    }
  });


  socket.on('disconnect', function () {
    console.log('Disconnected from client');
    if (typeof players[socket.id] !== 'undefined') { //} && rooms[socket.room_id].participants() < rooms[socket.room_id].required_participants){
      // save data of player
      var date = new Date();
      players[socket.id].end = date.toISOString();
      var data = players[socket.id];
      console.log(data);
      fs.writeFile(__dirname + '/data/' + socket.id + '_' + date.toISOString(), JSON.stringify(data), function (err) {
        if (err) {
          console.log(JSON.stringify(data));
          return console.log(err);
        }
      });
      // send messsage to all other players in the room (so AI can disconnect)
      io.in(socket.room_id).emit('player-left', { 'current_players': rooms[socket.room_id].participants() });
      // delete from players
      delete players[socket.id];
    }
    // destroy room if empty
    if (typeof rooms[socket.room_id] !== 'undefined' && rooms[socket.room_id].participants() == 0) {
      destroy_room(socket.room_id);
    }
  });

  // the following sets up "rooms", which will be useful later if players can play against other real players
  function find_room(data) {

    var room_to_join;
    var room_keys = Object.keys(rooms);

    if (room_keys.length == 0) {
      var new_room_id = uuid();
      rooms[new_room_id] = create_room(new_room_id, data.experiment);
      room_to_join = new_room_id;
    } else {
      // first join rooms that are waiting for players
      for (var i = 0; i < room_keys.length; i++) {
        if (
          // rooms[room_keys[i]].started == false &&
          rooms[room_keys[i]].started == false &&
          rooms[room_keys[i]].participants() > 0 &&
          rooms[room_keys[i]].participants() < rooms[room_keys[i]].required_participants &&
          rooms[room_keys[i]].experiment_id == data.experiment
        ) {
          room_to_join = rooms[room_keys[i]].id;
          break;
        }
      }
      // then make new empty room
      if (typeof room_to_join == 'undefined') {
        var new_room_id = uuid();
        rooms[new_room_id] = create_room(new_room_id, data.experiment);
        room_to_join = new_room_id;
      }
    }
    return room_to_join;
  }

  function create_room(id, experiment_id) {
    // check if there are any conditions left
    if (condition_array.length == 0) {
      // create new set of randomized conditions
      condition_array = conditions.slice();
      shuffleArray(condition_array);
    }
    // pick first element as condition for this room
    var condition = condition_array.splice(0, 1);
    console.log(condition);

    return {
      id,
      experiment_id,
      condition,
      required_participants: config.humans,
      players: config.players,
      started: false,
      current_game: "",
      current_round: 1,
      current_actions: [],
      score: {},
      data: {
        descriptives: {},
        rps: [],
        fwg: [],
        numbers: [],
        shootout: [],
        strategy: {}
      },
      participants: function () {
        try {
          return Object.keys(io.nsps['/'].adapter.rooms[this.id].sockets).length;
        } catch (e) {
          //console.log(e);
          return 0;
        } finally {

        }
      },
      join: function (socket) {
        socket.join(this.id);
        socket.room_id = this.id;
        //var condition = this.condition
        // add scores for this player

        if (this.participants() == this.required_participants) {
          // fill toom with AI players
          var ai_required = config.players - this.participants();
          if (ai_required > 0) {
            ai_agents[this.id] = [];
            for (var i = 1; i <= ai_required; i++) {
              var agent;
              if (this.condition == "Nash") {
                console.log("Creating Nash player");
                agent = new agents.NashPlayer(this.id);
              } else if (this.condition == "Level1") {
                console.log("Creating LevelOnePlayer");
                agent = new agents.LevelOnePlayer(this.id, config.epsilon);
              } else if (this.condition == "Level2") {
                console.log("Creating LevelTwoPlayer");
                agent = new agents.LevelTwoPlayer(this.id, config.epsilon);
              }
              ai_agents[this.id][i - 1] = agent;
              ai_agents[this.id][i - 1].join(this.id);
              //agent.join(this.id);
            }

          }
        }
        // socket.player_id = 1; // always the left player
        console.log(this.participants() + ' of ' + this.players + ' ready in room ' + this.id);
        if (this.participants() == this.players) {
          console.log('Starting room ' + this.id);
          this.start();
        }
      },
      start: function () {
        this.started = true;

        var clients = io.nsps['/'].adapter.rooms[this.id].sockets;
        // var idx = 0;
        for (var c in clients) {
          this.score[c] = {
            rps: 0,
            fwg: 0,
            numbers: 0,
            shootout: 0
          };
          io.sockets.connected[c].emit('start-room', { player_id: io.sockets.connected[c].player_id });
        }
      }
    };
  }

  function join_room(socket, room_to_join, data) {
    rooms[room_to_join].join(socket);
    //var tmp = {'id': socket.id, 'time': Date(), 'prolific_id': data.prolific_id}
    config.debug && console.log("Client %s joined room %s", socket.id, room_to_join);
    // store room in players
    players[socket.id].room = room_to_join;
  }

  function destroy_room(id) {
    try {
      console.log('Removing room ' + id);
      // console.log(JSON.stringify(rooms[id].session_data));
      var date = new Date();
      // use ___dirname in case script is ran from other working directory
      var data = {
        'condition': rooms[id].condition,
        'scores': rooms[id].score,
        'data': rooms[id].data
      };
      //fixed bug regarding score by replacing the array with an object when initilizing score
      fs.writeFile(__dirname + '/room_data/' + id + '_' + date.toISOString(), JSON.stringify(data), function (err) {
        if (err) {
          console.log(JSON.stringify(data));
          return console.log(err);
        }
      });
      // delete room from rooms array
      delete rooms[id];

      // delete ai agents in this room from the ai_agents array
      var index = ai_agents.indexOf(id);
      if (index > -1) {
        ai_agents.splice(index, 1);
      }
      //delete rooms[id];
      console.log('Removed a room. Current rooms: ' + JSON.stringify(Object.keys(rooms)));
    } catch (err) {
      console.log(err);
    }
  }


});
