function startJoe(){var e=getFirst();insertQuestion(e),$("body").on("click",".first-answer",function(e){if($(".first-answer").addClass("elimination-answer").removeClass("first-answer"),"positive-answer"===e.target.id){var n={};finishJoe(n)}"negative-answer"===e.target.id&&eliminationRound()})}function eliminationRound(){if(counter>=question_data.length)return void finishJoe();var e=question_data[counter];insertQuestion(e),$(".elimination-answer").off("click"),$(".elimination-answer").on("click",function(e){var n;switch("positive-answer"===e.target.id&&(n="pos"),"negative-answer"===e.target.id&&(n="neg"),counter){case 0:choices.size="pos"===n?{$in:[1]}:{$in:[2]};break;case 1:choices.strength="pos"===n?{$in:[1]}:{$in:[2]};break;case 2:"pos"===n?choices.milk={$in:[1]}:"neg"===n&&(choices.milk={$in:[0]},choices.milk_froth={$in:[0]});break;case 3:choices.milk_froth="pos"===n?{$in:[1]}:{$in:[2]}}counter++,checkDrinkAvailability(function(e){e>1?eliminationRound():finishJoe(availableDrinkArray[0])})})}function getFirst(){var e={phrase:"Goodmorning! How about an Espresso to kickstart your day?",drink_id:"589b134671f90d703a4cf695",drink_name:"Espresso",positive_answer:"Yeah, that sounds great. Hit me, Joe!",negative_answer:"No thanks, I'm in the mood for something different"};return e}function insertQuestion(e){joe_container.text(e.phrase).attr("data-drink-name",e.drink_name).attr("data-drink-id",e.drink_id),positive_answer_container.text(e.positive_answer),negative_answer_container.text(e.negative_answer)}function checkDrinkAvailability(e){sendToPath("post","/drinks",choices,function(n,i){availableDrinkArray=i,e(availableDrinkArray.length)})}function finishJoe(e){joe_container.text("Great! Here's your "+e.name)}function sendToPath(e,n,i,t,a){var o=a||t,r={url:n,type:e,contentType:"application/json",dataType:"json",data:JSON.stringify(i),xhrFields:{withCredentials:!0},success:function(e){if(1==e.status){if("NOT_LOGGED_IN"===e.code)return $.notify("You are no longer logged in - redirecting you to the front page","failure"),void setTimeout(function(){handleRegistrationNextStep(e.next_step)},3e3);o(e)}else o(void 0,e)},error:function(e){o(e.responseJSON?e.responseJSON:{status:1,message:"Action failed, please try again later"})}};a&&(r.xhr=function(){var e=new window.XMLHttpRequest;return e.upload&&e.upload.addEventListener("progress",function(e){if(e.lengthComputable){var n=e.loaded/e.total;t(n)}},!1),e}),$.ajax(r)}var joe_container,positive_answer_container,negative_answer_container,bannedDrinkArray=[],availableDrinkArray=[],counter=0,choices={},question_data=[{phrase:"Big or small?",positive_answer:"Small for me",negative_answer:"Big, please!"},{phrase:"How strong?",positive_answer:"Not too strong",negative_answer:"Give me a kick!"},{phrase:"You want milk in that?",positive_answer:"Yes, please",negative_answer:"I like it black like my soul!"},{phrase:"How frothy you want that milk?",positive_answer:"Lots of froth",negative_answer:"No froth"}];$(document).ready(function(){joe_container=$(".joe"),positive_answer_container=$("#positive-answer"),negative_answer_container=$("#negative-answer"),startJoe()});