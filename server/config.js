module.exports = {
  debug: true,
  path: '/rps',
  port: '8075',
  local: true,
  trial: 3,
  players: 2,
  humans: 1,
  epsilon: 0.10,
  minimum_decision_time: 500,
  maximum_decision_time: 2000,
  game_actions: {
    rps: ['rock', 'paper', 'scissors'],
    fwg: ['fire', 'water', 'grass'],
    numbers: ['one', 'two', 'three', 'four', 'five'],
    shootout: ['left', 'center', 'right']
  },

  game_numRounds: {
    debug : {
      rps: 3,
      fwg: 3,
      numbers: 0,
      shootout: 10
    },
    normal : {
      rps: 10,
      fwg: 10,
      numbers: 0,
      shootout: 10
    }
  },


  remote_server: '',
  remote_redirect: 'https://app.prolific.ac/submissions/complete?cc=ISG3J88A',
  local_redirect: 'https://www.duckduckgo.com',
  get local_server() {
    return `http://localhost:${this.port}`
  },
  getServerAddress() {
    return this.local
      ? this.local_server //+ config.path
      : this.remote_server //+ config.path
  }
};
