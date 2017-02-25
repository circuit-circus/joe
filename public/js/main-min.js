function startWaiting(){var e={phrase:"Hi there! I'm Joe, your personal barista. Tap your name tag on the reader to get started!",positive_answer:"I don't have a name tag :(",negative_answer:"I don't have a name tag :("};$(".answer-container").show(),$(".answer-option").addClass("waiting-answer").removeClass("elimination-answer icebreaker-answer"),insertQuestion(e),socket.on("visitorCheckedIn",function(e){isServing||startIcebreaker(e)}),socket.on("couldNotFindGuest",function(e){isServing||startIcebreaker()}),$("body").on("click",".waiting-answer",function(){isServing||startIcebreaker()})}function startIcebreaker(e){isServing=!0,$(".waiting-answer").addClass("icebreaker-answer").removeClass("waiting-answer"),getIcebreaker(e,function(e){insertQuestion(e),$("body").on("click",".icebreaker-answer",function(){},function(t){$(".icebreaker-answer").addClass("elimination-answer").removeClass("icebreaker-answer");var n=$(this).text(),a=$(".chat-answer-template").clone();a.text(n),a.removeClass("chat-answer-template").addClass("chat-answer"),$(".conversation-container").append(a),"positive-answer"===t.target.id&&finishJoe(e),"negative-answer"===t.target.id&&(bannedDrinkArray.push(e._id),eliminationRound())})})}function getIcebreaker(e,t){var n=void 0===e?{}:e[0],a=getLocation();getWeatherInfo(a,function(e){var a=[],o=[],i=["How about a hot cup of [DRINK]?","I recommend a nice cup of [DRINK]!"],r=date.getHours(),s={phrase:"How about an Espresso?",_id:"589b134671f90d703a4cf695",name:"Espresso",positive_answer:"Yeah, that sounds great. Hit me, Joe!",negative_answer:"No thanks, I'm in the mood for something different",coffee_number:0},c=i[Math.floor(Math.random()*i.length)],l=!1,d=!1;Math.random()<.2&&!jQuery.isEmptyObject(e)?l=!0:Math.random()<.6&&(d=!0),a=r>=6&&11>r?["Goodmorning [VISITOR]!","Hi [VISITOR], hope you're having a great morning!"]:r>=11&&14>r?["Hi there [VISITOR]!","Hello [VISITOR], how are you?","Hi [VISITOR]! So nice to see you.","Welcome [VISITOR]!"]:r>=14&&18>r?["Goodafternoon [VISITOR]!","Hi [VISITOR], so nice to see you this afternoon."]:r>=18&&23>r?["Goodevening [VISITOR]!","Goodevening [VISITOR], hope you're doing fine this lovely evening.","Hi [VISITOR], in the mood for an evening coffee?"]:["Hi there [VISITOR]!","Hello [VISITOR]!"];var h=a[Math.floor(Math.random()*a.length)],u=["buddy","friend"],g=n.name?n.name:u[Math.floor(Math.random()*u.length)];l?(parseInt(e.cloudiness)>75?o=["Woah, it's looking cloudy!","Man, those clouds just won't quit today!"]:parseInt(e.fog)>55?o=["It sure is foggy today. You can barely see a thing!","I heard that coffee tastes better when it's foggy, so today must be a great coffee day, huh?"]:parseInt(e.rain)>5?o=["With all this rain, it's a good thing we're inside!",'Ever heard the expression "When it rains, it pours"? I\'m pretty sure they mean it pours coffee.']:parseInt(e.temperature)<5?o=["It's a cold one out there today. You better warm yourself with a cuppa joe.","Some people say you should drink cold drinks, when it's cold. I strongly disagree with those people."]:parseInt(e.windSpeed.beaufort)>5&&(o=["Wow, the wind is really building up today!","In this windy weather, luckily getting a coffee is a breeze."]),h+=" "+o[Math.floor(Math.random()*o.length)]):d&&void 0!==n.last_drink&&(s._id=n.last_drink.drink_id,s.name=n.last_drink.drink_name),c=c.replace("[DRINK]",s.name),h=h.replace("[VISITOR]",g),s.phrase=h+" "+c,t(s)})}function getLocation(){return 2===date.getMonth()?date.getDate()<29?HELSINKI_LOC:STOCKHOLM_LOC:COPENHAGEN_LOC}function getWeatherInfo(e,t){sendToPath("post","/weather",e,function(e,n){weather_data=void 0===n.errno?n:{},t(weather_data)})}function eliminationRound(){var e=question_data[questionCounter];insertQuestion(e),$(".elimination-answer").off("click"),$(".elimination-answer").on("click",function(e){var t=$(this).text(),n=$(".chat-answer-template").clone();n.text(t),n.removeClass("chat-answer-template").addClass("chat-answer"),$(".conversation-container").append(n);var a;switch("positive-answer"===e.target.id&&(a="pos"),"negative-answer"===e.target.id&&(a="neg"),questionCounter){case 0:choices.size="pos"===a?{$in:[1]}:{$in:[2]};break;case 1:choices.strength="pos"===a?{$in:[1]}:{$in:[2]};break;case 2:"pos"===a?choices.milk={$in:[1]}:"neg"===a&&(choices.milk={$in:[0]},choices.milk_froth={$in:[0]});break;case 3:choices.milk_froth="pos"===a?{$in:[1]}:{$in:[2]}}questionCounter++,checkDrinkAvailability(function(e){e>1?eliminationRound():getConfirmation(availableDrinkArray[0])})})}function insertQuestion(e){var t=$(".chat-question-template").clone();t.text(e.phrase),t.removeClass("chat-question-template").addClass("chat-question"),$(".conversation-container").append(t),$(".answer-option#positive-answer").text(e.positive_answer),$(".answer-option#negative-answer").text(e.negative_answer),scrollConversation()}function scrollConversation(){var e=$(".chat-buble").last(),t=Math.abs($(".conversation-container")[0].scrollHeight-e.offset().top+e.height());$(".conversation-container").animate({scrollTop:t},750)}function checkDrinkAvailability(e){var t=choices;t._id={$nin:bannedDrinkArray},console.log(t),sendToPath("post","/drinks",t,function(t,n){console.log(n),availableDrinkArray=n,e(availableDrinkArray.length)})}function getVisitorInfo(){var e={first_name:"Nina",last_name:"Højholdt",last_drink:{drink_name:"Americano",drink_id:"589b133671f90d703a4cf693"}};return e}function getConfirmation(e){var t={phrase:"Great! What do you think of getting a "+e.name+" then?",positive_answer:"I'd love one of those! Hook me up with a cup of "+e.name+"!",negative_answer:"No, that wasn't exactly what I was looking for."};insertQuestion(t),$(".elimination-answer").off("click"),$(".elimination-answer").on("click",function(t){var n=$(this).text(),a=$(".chat-answer-template").clone();a.text(n),a.removeClass("chat-answer-template").addClass("chat-answer"),$(".conversation-container").append(a);var o;"positive-answer"===t.target.id&&(o="pos"),"negative-answer"===t.target.id&&(o="neg"),"pos"===o?finishJoe(e):(choices={},bannedDrinkArray.push(e._id),questionCounter=0,eliminationRound())})}function finishJoe(e){var t=$('<div class="chat-question chat-buble"></div>');t.text("Great! Here's your "+e.name),$(".conversation-container").append(t),scrollConversation(),$(".answer-container").hide(),sendToPath("post","/dispense",e,function(e,t){console.log(t)}),setTimeout(function(){isServing=!1,questionCounter=0,$(".conversation-container .chat-buble:not(.chat-question-template, .chat-answer-template)").remove(),startWaiting()},2e3)}function sendToPath(e,t,n,a,o){var i=o||a,r={url:t,type:e,contentType:"application/json",dataType:"json",data:JSON.stringify(n),xhrFields:{withCredentials:!0},success:function(e){if(1==e.status){if("NOT_LOGGED_IN"===e.code)return $.notify("You are no longer logged in - redirecting you to the front page","failure"),void setTimeout(function(){handleRegistrationNextStep(e.next_step)},3e3);i(e)}else i(void 0,e)},error:function(e){i(e.responseJSON?e.responseJSON:{status:1,message:"Action failed, please try again later"})}};o&&(r.xhr=function(){var e=new window.XMLHttpRequest;return e.upload&&e.upload.addEventListener("progress",function(e){if(e.lengthComputable){var t=e.loaded/e.total;a(t)}},!1),e}),$.ajax(r)}var socket=io(),HELSINKI_LOC={latitude:60.16952,longitude:24.93545},STOCKHOLM_LOC={latitude:59.33258,longitude:18.0649},COPENHAGEN_LOC={latitude:55.67594,longitude:12.56553},weather_data={},date=new Date,bannedDrinkArray=[],availableDrinkArray=[],choices={},isServing=!1,questionCounter=0,question_data=[{phrase:"Would you prefer a big or a small coffee?",positive_answer:"Small for me",negative_answer:"Big, please!"},{phrase:"How strong do you like it?",positive_answer:"Not too strong",negative_answer:"Give me a kick!"},{phrase:"You want milk in that?",positive_answer:"Yes, please",negative_answer:"I like it black like my soul!"},{phrase:"How frothy you want that milk?",positive_answer:"Lots of froth",negative_answer:"No froth"}];$(document).ready(function(){socket.on("buttonPress",function(e){"L"===e?$("#positive-answer").click():"R"===e&&$("#negative-answer").click()}),isServing||startWaiting()});