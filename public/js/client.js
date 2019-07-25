// Debug var allows us to speed up going through tests and entering data in debug mode.
//change to false before going live
var debug = true;

// Number of seconds given to participants before each choice.
//chnge to 5 post debuging.
const countDownTime = 2;
const feedbackSeconds = 2;
const roundFlashingSeconds = 2;
const infoElement = $('.info');
const info2Element = $('.info2');
const roundNumberElement = $('.roundNumber');
const resultsElement = $('.results');
const outcomeIconElement = $('.outcome-icon');

const outcomesConfig = {
  win: {
    resultMessage: 'You win!',
    multipleSpelling: 'wins',
    audioVolume: 0.03
  },
  tie: {
    resultMessage: 'It was a tie.',
    multipleSpelling: 'ties',
    audioVolume: 0.2,
  },
  loss: {
    resultMessage: 'Your opponent wins!',
    multipleSpelling: 'losses',
    audioVolume: 0.1
  }
};

class Game {
  constructor(gameNumber, gameType, buttons, debrief, buttonToTriggerCurrentInstructions, prevInstructionsDiv, testConfig, gameImagePrefix) {
    this.firstRound = true;
    this.gameNumber = gameNumber;
    this.gameNumberEmptyForFirst = this.gameNumber === 1 ? '' : this.gameNumber;
    this.gameType = gameType;
    this.debrief = debrief;
    this.debriefDiv = $(`#debrief${this.gameNumber}-div`);
    this.gameDiv = $(`#game${this.gameNumber}-div`);
    this.roundListDiv = this.gameDiv.find('.round-feedback-list');
    this.buttons = buttons;
    this.buttonToTriggerCurrentInstructions = buttonToTriggerCurrentInstructions;
    this.prevInstructionsDiv = prevInstructionsDiv;

    this.buttonToTriggerCurrentInstructions = '#instructions0';
    this.prevInstructionsDiv = 'instructions0-div';

    this.testConfig = testConfig;
    this.gameImagePrefix = gameImagePrefix;
    this.round = 1;

    this.gameCounter = {
      wins: 0,
      ties: 0,
      losses: 0,
    };

    this.buttons.on('click', this.takeAction.bind(this));

    this.initScreen();
    this.setTestAndInstructionEvents();
  }

  initScreen() {
    roundNumberElement.html(`Round : 1`);
    $('.losses').html('0');
    $('.wins').html('0');
    $('.ties').html('0');
    infoElement.html('');
    info2Element.html('');
    resultsElement.html('');
  }

  setTestAndInstructionEvents() {
    $('#instructions' + this.gameNumber).click(() => {
      $(`#instructions${this.gameNumber}-div`).hide();
      $(`#test${this.gameNumber}-div`).show();
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    });

    $(this.buttonToTriggerCurrentInstructions || '#testInstruct' + this.gameNumber).click(() => {
      $('#' + (this.prevInstructionsDiv || `test${this.gameNumber}-div`)).hide();
      $(`#instructions${this.gameNumber}-div`).show();
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    });

    $('#testSubmit' + this.gameNumber).click(() => {
      const val1 = $(this.testConfig.q1).val();
      const val2 = $(this.testConfig.q2).val();
      const val3 = $(this.testConfig.q3).val();

      if (val1 === this.testConfig.val1 && val2 === this.testConfig.val2 && val3 === this.testConfig.val3) {
        socket.emit('start-game-request', { game: this.gameType });
      } else if (debug) {
        socket.emit('start-game-request', { game: this.gameType });
      } else {
        $('#errorMsg' + this.gameNumberEmptyForFirst).show();
      }
    });
  }

  startGame() {
    $(`#test${this.gameNumber}-div`).hide();
    $(`#game${this.gameNumber}-div`).show();
    $('#humanPlay' + this.gameNumberEmptyForFirst).attr('src', 'pics/white.jpg');
    $('#computerPlay' + this.gameNumberEmptyForFirst).attr('src', 'pics/white.jpg');

    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  }

  startRound(data, shuffleWeapons = true) {
    roundNumberElement.html(`Round : <span class="black-flashing-text">${data.round}</span>`);
    setTimeout(() => {
      roundNumberElement.html(`Round : ${data.round}`);
    }, roundFlashingSeconds * 1000);

    if (shuffleWeapons) {
      this.shuffleWeapons();
    }

    infoElement.html('');
    info2Element.html('');
    resultsElement.html('');
    outcomeIconElement.css('display', 'none');
    let timerCounter = 0;

    const doStartRound = () => {
      this.firstRound = false;
      info2Element.html(`
          <h3 class="red-flashing-text">Choose action now</h3>
        `);
      startRoundTime = Date.now();
      this.canSubmitChoice = true;
      this.buttons.prop('disabled', false);
    };

    if (this.firstRound) {
      doStartRound();
    } else {
      const tickTimer = () => {
        if (timerCounter++ < countDownTime) {
          info2Element.html(`
              <h3>Choose action in...</h3>
              <h2>${countDownTime - timerCounter + 1}</h2>
            `);
        } else {
          clearInterval(timerInterval);
          doStartRound();
        }
      };
      tickTimer();
      const timerInterval = setInterval(tickTimer, 1000);
    }
  }

  shuffleWeapons() {
    const parent = this.gameDiv.find('.weapons');
    const divs = parent.children();
    while (divs.length) {
      parent.append(divs.splice(Math.floor(Math.random() * divs.length), 1)[0]);
    }
  }

  takeAction(e) {
    if (!this.canSubmitChoice) return alert('you have already made a choice !');

    this.canSubmitChoice = false;
    this.buttons.prop('disabled', true);

    const reactionTime = Date.now() - startRoundTime;

    info2Element.html('');
    $('.humanPlay').attr('src', 'pics/tenor.gif');
    $('.computerPlay').attr('src', 'pics/tenor.gif');

    console.log(`Human choice is ${e.target.id}`);

    const data = {
      game: this.gameType,
      action: e.target.id,
      rt: reactionTime
    };

    socket.emit('take-action', data);
  }

  roundFeedback(choices, outcome, delay = 0) {

    // Giving a error after calling this is timeout
    var selfObj = this;
    var selfObj = currentGame;

    info2Element.html('');

    $('.humanPlay').attr('src', `pics/${choices[0]['action']}.jpg`);

    $('.computerPlay').attr('src', `pics/${selfObj.gameImagePrefix + choices[1]['action']}.jpg`);

    setTimeout(() => {
      infoElement.html('You picked ' + choices[0]['action'] + '.');
    });

    setTimeout(() => {
      $('.computerPlay').attr('src', `pics/${selfObj.gameImagePrefix + choices[1]['action']}.jpg`);
      info2Element.html('Your opponent picked ' + choices[1]['action'] + '.');
    }, 250);



    setTimeout(() => {
      resultsElement.html(outcomesConfig[outcome].resultMessage);
      outcomeIconElement.attr('src', `pics/icon-${outcome}.png`);
      outcomeIconElement.css('display', `block`);

      const counter = ++selfObj.gameCounter[outcomesConfig[outcome].multipleSpelling];
      $('.' + outcomesConfig[outcome].multipleSpelling).html(counter);
      const outcomeAudio = $(`#round-${outcome}-audio`)[0];
      outcomeAudio.volume = outcomesConfig[outcome].audioVolume;
      outcomeAudio.play();
    }, 500);


    setTimeout(() => {
      selfObj.pushRoundFeedbackInTheList(choices, outcome);
      socket.emit('feedback-done');
    }, feedbackSeconds * 1000 + delay);
  }

  pushRoundFeedbackInTheList(choices, outcome) {
    const outcomeComputer = outcome === 'win' ? 'loss' : (outcome === 'loss' ? 'win' : 'tie');
    this.roundListDiv.find('.last').removeClass('last');
    this.roundListDiv.prepend(`
        <div class="round-feedback-item last">
            <span class="round-feedback-item-icon ${outcome}"><img src="pics/${choices[0]['action']}Icon.jpg"></span>
            <span class="round-feedback-item-title">Round ${this.round++}</span>
            <span class="round-feedback-item-icon ${outcomeComputer}"><img src="pics/${choices[1]['action']}Icon.jpg"></span>
        </div>
      `);
  }

  gameFinished(data, lastGame) {
    const debriefMessage = !lastGame
      ? `This is the end of game ${this.gameNumber}. Your score in this game is ${data.score} points.`
      : `Thank you for taking part in this experiment. Your score in Game ${this.gameNumber} is: ${data.score} points. Your total score is ${data.total_score} points. We would like to ask you a few questions before you go. You can use the sliders below to answer the questions.`

    if(lastGame){
      this.debrief = $('#debrief4score');
      this.debriefDiv = $(`#debrief4-div`);
    }
    this.debrief.html(debriefMessage);
    this.gameDiv.hide();
    this.debriefDiv.show();


    //
    // Next Step Logic

    if(lastGame){
      return;
    }
    var startNextBtn   = this.debriefDiv.find('.start-next');
    var nextStageCount = parseInt( this.debriefDiv.find('.start-next').attr('data-start') ) || 0;
    if(nextStageCount < 0 || data.sNextRounds < 0){
      return;
    }
    startNextBtn.attr('data-start', nextStageCount + data.sNextRounds );
  }
}

class RPSGame extends Game {
  constructor() {
    super(1, 'rps', $('#rock,#paper,#scissors'), $('#debrief1score'), '#instructions0', 'instructions0-div', {
      q1: '#q1',
      q2: '#q2',
      q3: '#q3',
      val1: '50',
      val2: 'paper',
      val3: 'scissors'
    }, 'R');
  }

  gameFinished(data) {
    switch(data.sNextRounds){
      case 1:
        currentGame = new NumbersGame();
        super.gameFinished(data);
      break;
      case 2:
        currentGame = new ShootoutGame();
        super.gameFinished(data);
      break;
      case 3:
        super.gameFinished(data, true);
      break;
      default:
        currentGame = new FWGGame();
        super.gameFinished(data);
      break;
    }

  }
}

class FWGGame extends Game {
  constructor() {
    super(2, 'fwg', $('#fire,#water,#grass'), $('#debrief2score'), null, null, {
      q1: '#q4',
      q2: '#q5',
      q3: '#q6',
      val1: '50',
      val2: 'grass',
      val3: 'fire'
    }, '');
  }

  gameFinished(data) {
    switch(data.sNextRounds){
      case 1:
        currentGame = new ShootoutGame();
        super.gameFinished(data);
      break;
      case 2:
        super.gameFinished(data, true);
      break;
      default:
        currentGame = new NumbersGame();
        super.gameFinished(data);
      break;
    }
  }
}

class NumbersGame extends Game {
  constructor() {
    super(3, 'numbers', $('#one,#two,#three,#four,#five'), $('#debrief3score'), null, null, {
      q1: '#q7',
      q2: '#q8',
      q3: '#q9',
      val1: '50',
      val2: '3',
      val3: '1'
    }, '');
  }

  gameFinished(data) {
    switch(data.sNextRounds){
      case 1:
         super.gameFinished(data, true);
      break;
      default:
        currentGame = new ShootoutGame();
        super.gameFinished(data);
      break;
    }
  }
}

class ShootoutGame extends Game {
  constructor() {
    super(4, 'shootout', $('#left,#center,#right'), $('#debrief4score'), null, null, {
      q1: '#q10',
      q2: '#q11',
      q3: '#q12',
      val1: '50',
      val2: 'left/center',
      val3: 'right/left'
    }, '');
  }

  createVideo([player, agent], callbackInfo) {
    const getValue = action => ['a', 'b', 'c'][['left', 'center', 'right'].indexOf(action)] + '2';
    const folder = `${getValue(player.action)} ${getValue(agent.action)}`;


    $('#video-modal').html();

    let video = $('<video>').appendTo('#video-modal')[0];

    ['m4v', 'webm', 'ogv', 'mp4' ].forEach(format => {
      /* First source element creation */
      const source = document.createElement("source");

      /* Attribute settings for my first source */
      source.setAttribute('src', `videos/${folder}/extraction50fps/animation.${format}`);
      source.setAttribute('type', 'video/'+format);
      source.setAttribute('playsinline', 'true');

      /* Append the first source element to the video element */
      video.appendChild(source);
    });


    $("#video-modal").modal({
      escapeClose: false,
      clickClose: false,
      showClose: false
    });

    video.autoplay = true;

    video.addEventListener('ended', () => {
      setTimeout(() => {
        $.modal.close();
        video.remove();
        callbackInfo.func( callbackInfo.choices, callbackInfo.outcome, callbackInfo.timeout );

      }, 500);
    });
  }

  startRound(data) {
    super.startRound(data, false);
  }

  roundFeedback(choices, outcome) {
    // super.roundFeedback(choices, outcome, 5500);

    this.createVideo(choices, {
      func    : super.roundFeedback,
      outcome : outcome,
      choices : choices,
      timeout : 500
    });

  }

  gameFinished(data) {
    super.gameFinished(data, true);
  }
}

const socket = io(_SERVER_ADDRESS, { path: _PATH + '/socket.io' });
let startRoundTime;
let currentGame;


socket.on('connect', () => {
  console.log('Connected to Server');
  socket.emit('join-room', {});
});


//
// Adding Code for the first game, based on config saved
// In server calling the required game
//

socket.on('join-room-reply',(data) => {

  stepConfig = data.stepConfig;

  if(typeof(stepConfig) !== 'undefined'){
    $(['rps', 'fwg', 'numbers', 'shootout']).each(function(index,gameType){

      if(typeof(stepConfig[gameType]) == 'undefined'){
        return true;
      }

      count = stepConfig[gameType];

      if(count == 0){
        return true;
      }

      switch(gameType){
        case 'rps':
          currentGame = new RPSGame();
        break;
        case 'fwg':
          currentGame = new FWGGame();
        break;
        case 'numbers':
          currentGame = new NumbersGame();
        break;
        case 'shootout':
          currentGame = new ShootoutGame();
        break;
      }

      return false;
    });
  }
});

socket.on('start-game', (data) => {
  currentGame.startGame(data);
});

socket.on('start-round', (data) => {
  currentGame.startRound(data);
});

['win', 'tie', 'loss'].forEach((result) => {
  socket.on(result, (choices) => {
    currentGame.roundFeedback(choices, result);
  });
});

socket.on('finish-game', (data) => {
  console.log('finish game');
  console.log(data);
  setTimeout(() => {
    currentGame.gameFinished(data);
  }, 500);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('colorfill', (color) => {
  $('.oppColor').attr('fill', color);
});

////////////////////////////////
//User Id screen
////////////////////////////////////////////
$('#user-data-submit').click(() => {
  const id = $('#prolificIDinput').val();

  if (id !== '') {
    socket.emit('send-user-data', { id });
    $('#form-div').hide();
    $('#instructions0-div').show();
  }
    // try to bypass in debug module
  else if (debug) {
    socket.emit('send-user-data', { });
    $('#form-div').hide();
    $('#instructions0-div').show();
  } else {
    $('#userFormErrorMsg').show();

  }
});

// Start-next buttons
$('.start-next').click(function () {
  $('#debrief' + $(this).data('end') + '-div').hide();
  $('#instructions' + $(this).data('start') + '-div').show();
});


(function survey() {
  // Survey Code:
  const slider1 = document.getElementById('myRange1');
  const output1 = document.getElementById('demo1');
  output1.innerHTML = slider1.value;

  slider1.oninput = function () {
    output1.innerHTML = this.value;
  };

  const slider2 = document.getElementById('myRange2');
  const output2 = document.getElementById('demo2');
  output2.innerHTML = slider2.value;

  slider2.oninput = function () {
    output2.innerHTML = this.value;
  };

  // End of Experiment deal with debrief data
  $('#endExp').click(() => {
    socket.emit('insight-questions', {
      prolificID: $('#inputID').val(),
      difficulty: slider1.value,
      confidence: slider2.value,
      comments: $('#feedbackinput').val()
    });

    $('#debrief3-div').hide();
    $('#prolific-div').show();
  });
})();

$('#prolificBtn').click(() => {
  window.location.href = '//app.prolific.ac/submissions/complete?cc=KTBMLVRR'
});
