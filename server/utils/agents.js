// from https://stackoverflow.com/questions/36073372/adding-a-chatbot-in-socket-io-basic-chat-application
//
var config = require('../config');

const sio = require('socket.io-client');
var socketAddress = config.getServerAddress();

function Agent(room_id) {
  this.socket = undefined;
  this.room_id = room_id;
  this.minimumRT = config.minimum_decision_time;
  this.maximumRT = config.maximum_decision_time;
  this.states = [],
    this.actions = [],
    this.rewards = []
}

Agent.prototype.join = function (room_id) {
  this.socket = sio(socketAddress, { path: config.path + '/socket.io' });
  this.socket.room_id = room_id;
  this.room_id = room_id;
  var socket = this.socket;

  socket.on('connect', this.connect_listener.bind(this));
  socket.on('start-game', this.start_game_listener.bind(this));
  socket.on('start-round', this.start_round_listener.bind(this));
  socket.on('win', this.win_listener.bind(this));
  socket.on('loss', this.loss_listener.bind(this));
  socket.on('tie', this.tie_listener.bind(this));
  socket.on('player-left', this.player_left_listener.bind(this)); //I FORGOT THIS //EDIT: ANOTHER BUG FIXED
};

Agent.prototype.connect_listener = function () {
  var socket = this.socket;
  config.debug && console.log('Agent with socket id %s will attempt to join room %s', socket, this.room_id);
  socket.emit('join-room', { 'room_id': this.room_id });
}

Agent.prototype.leave = function () {
  var socket = this.socket;
  socket.disconnect();
};

Agent.prototype.start_game_listener = function (data) {
  this.states = [],
    this.actions = [],
    this.rewards = []
  config.debug && console.log('start-game received')
}

Agent.prototype.start_round_listener = function (data) {
  config.debug && console.log('start-round received in game %s by %s', data.game, this.socket.id);
  var state = [];

  if (this.states.length > 0) {
    state = this.states[this.states.length - 1];
  }

  var actions = config.game_actions[data.game];

  this.take_action(state, actions);
}

Agent.prototype.win_listener = function (data) {
  var state = {
    my_action: data[0].action,
    opponent_action: data[1].action
  }
  var reward = 1;
  this.update(state, reward);
  this.socket.emit('feedback-done');
};

Agent.prototype.loss_listener = function (data) {
  var state = {
    my_action: data[0].action,
    opponent_action: data[1].action
  }
  var reward = -1;
  this.update(state, reward);
  this.socket.emit('feedback-done');
};

Agent.prototype.tie_listener = function (data) {
  var state = {
    my_action: data[0].action,
    opponent_action: data[1].action
  }
  var reward = 0;
  this.update(state, reward);
  this.socket.emit('feedback-done');
};

Agent.prototype.new_message_listener = function (data) {
  var socket = this.socket;
  if (data.message == 'Hello, HAL. Do you read me, HAL?')
    socket.emit('message', 'Affirmative, ' + data.username + '. I read you.');
};

Agent.prototype.player_left_listener = function (data) {
  if (data.current_players == 1) {
    // agent is all alone :-(
    // better leave
    this.leave();
  }
};

Agent.prototype.determine_RT = function () {
  return this.minimumRT + Math.random() * (this.maximumRT - this.minimumRT);
};

Agent.prototype.take_action = function (state, actions) {
  var socket = this.socket;
  config.debug && console.log('%s is taking action from actions %s', socket.id, actions);

  var act = actions[0] === 'left'
    ? random(actions)
    : this.determine_action(state, actions);

  config.debug && console.log('%s took action %s', socket.id, act, state);
  var random_RT = this.determine_RT()
  this.timeout = setTimeout(function () {
    socket.emit('take-action', { action: act, rt: random_RT, agent: true });
  }, random_RT);
  this.actions.push(act);
};

Agent.prototype.update = function (state, reward) {
  this.states.push(state);
  this.rewards.push(reward);
}

Agent.prototype.constructor = Agent;


function NashPlayer(room_id) {
  Agent.call(this, room_id);
}

NashPlayer.prototype = Object.create(new Agent());

NashPlayer.prototype.determine_action = function (state, actions) {
  var item = actions[Math.floor(Math.random() * actions.length)];
  return item;
}

NashPlayer.prototype.constructor = NashPlayer;

//Level 1 Agent
function LevelOnePlayer(room_id, epsilon) {
  Agent.call(this, room_id);
  this.epsilon = epsilon;
}


LevelOnePlayer.prototype = Object.create(new Agent());

LevelOnePlayer.prototype.constructor = LevelOnePlayer;

LevelOnePlayer.prototype.determine_action = function (state, actions) {
  config.debug && console.log(this.states);
  if (Math.random() <= this.epsilon || this.states.length == 0) {
    return actions[Math.floor(Math.random() * actions.length)];
  } else {
    var state = this.states[this.states.length - 1];
    return best_response(state.opponent_action);
  }
}

//Level 2 agent
function LevelTwoPlayer(room_id, epsilon) {
  Agent.call(this, room_id);
  this.epsilon = epsilon;
}

LevelTwoPlayer.prototype = Object.create(new Agent());

LevelTwoPlayer.prototype.constructor = LevelTwoPlayer;

LevelTwoPlayer.prototype.determine_action = function (state, actions) {
  config.debug && console.log(this.states);
  if (Math.random() <= this.epsilon || this.states.length == 0) {
    var item = actions[Math.floor(Math.random() * actions.length)];
    return item;
  } else {
    var state = this.states[this.states.length - 1];
    return best_response(best_response(state.my_action));
  }
}

const random = (actions) => actions[Math.floor(Math.random() * actions.length)];

const best_response = function (weapon) {
  if (weapon === "rock") return "paper";
  else if (weapon === "paper") return "scissors";
  else if (weapon === "scissors") return "rock";
  else if (weapon === "fire") return "water";
  else if (weapon === "water") return "grass";
  else if (weapon === "grass") return "fire";
  else if (weapon === "one") return "two";
  else if (weapon === "two") return "three";
  else if (weapon === "three") return "four";
  else if (weapon === "four") return "five";
  else if (weapon === "five") return "one";
};

exports.Agent = Agent;
exports.NashPlayer = NashPlayer;
exports.LevelOnePlayer = LevelOnePlayer;
exports.LevelTwoPlayer = LevelTwoPlayer;
