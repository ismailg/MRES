// const {server} = require('./server');

var beatenKey = function (weapon) {
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

var nashPlay = function(list=weapons) {
  var item = list[Math.floor(Math.random()*list.length)];
return item;
};

var rand = function(min, max) {
    return Math.random() * (max - min) + min;
};
//If the random number falls in the first slot which is 0.5 or weight[0] then choose
//..the first item from the list. If it falls in the second slot which is between
//.. weight[0] and weight[0] + weight[1] then select the corresponding item from the list.
//.. For third item random number must fall in the third slot which would be between
//.. weight[0] + weight[1] and weight[0] + weight[1] + weight[2], and the sequence goes on.
var biasedComp = function(weight,weapons) {
    var total_weight = weight.reduce(function (prev, cur, i, arr) {
        return prev + cur;
    });

    var random_num = rand(0, total_weight);
    var weight_sum = 0;
    //console.log(random_num)
    for (var i = 0; i < weapons.length; i++) {
        weight_sum += weight[i];
        weight_sum = +weight_sum.toFixed(2);

        if (random_num <= weight_sum) {
          //return the wanted strategy x% of the time and nash (1-x%) of the time
            return weapons[i];
        }
    }
};


// play strategy that would have beaten last play's particiapnt's choice (whether won or lost)
var lvl1Comp = function(logs,list,freq=0.9) {
  var random_num = rand(0,1);
  if ((logs.length === 0) || (random_num > freq)) {
    return nashPlay(list);
  } else {
    var lastRound = logs[logs.length - 1];
    // return weapon that would have beaten last choice by human
    return beatenKey(lastRound.human);
  }
};
// high level : plays strategy that would have beaten last participant choice.
var lvl2Comp = function(logs,list,freq=0.9) {
  var random_num = rand(0,1);
  if ((logs.length === 0) || (random_num > freq)) {
    return nashPlay(list);
  } else {
    var lastRound = logs[logs.length - 1];
    // considers human as lvl 1player, so would have chosen weapon that would have beaten last computer play.
    //therefore best response is to play the weapon that would beat that choice.
    return beatenKey(beatenKey(lastRound.computer));
  }
};


module.exports = {
  nashPlay,
  lvl2Comp,
  lvl1Comp,
};
