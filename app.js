'use strict';




const apiai = require('apiai');
const config = require('./config');
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const uuid = require('uuid');
var codes;
refreshToken();


// Messenger API parameters
if (!config.FB_PAGE_TOKEN) {
	throw new Error('missing FB_PAGE_TOKEN');
}
if (!config.FB_VERIFY_TOKEN) {
	throw new Error('missing FB_VERIFY_TOKEN');
}
if (!config.API_AI_CLIENT_ACCESS_TOKEN) {
	throw new Error('missing API_AI_CLIENT_ACCESS_TOKEN');
}
if (!config.FB_APP_SECRET) {
	throw new Error('missing FB_APP_SECRET');
}
if (!config.SERVER_URL) { //used for ink to static files
	throw new Error('missing SERVER_URL');
}



app.set('port', (process.env.PORT || 5000))

//verify request came from facebook
app.use(bodyParser.json({
	verify: verifyRequestSignature
}));

//serve static files in the public directory
app.use(express.static('public'));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
	extended: false
}))

// Process application/json
app.use(bodyParser.json())




const apiAiService = apiai(config.API_AI_CLIENT_ACCESS_TOKEN, {
	language: "en",
	requestSource: "fb"
});
const sessionIds = new Map();

// Index route
app.get('/', function (req, res) {
	res.send('Hello world, I am a chat bot')
})

app.get('/google0fcf00e2ee3ad649.html', function (req, res) {
	res.send('google-site-verification: google0fcf00e2ee3ad649.html')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
	console.log("request");
	if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.FB_VERIFY_TOKEN) {
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
		res.sendStatus(403);
	}
})

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook/', function (req, res) {
	var data = req.body;
	console.log(JSON.stringify(data));



	// Make sure this is a page subscription
	if (data.object == 'page') {
		// Iterate over each entry
		// There may be multiple if batched
		data.entry.forEach(function (pageEntry) {
			var pageID = pageEntry.id;
			var timeOfEvent = pageEntry.time;

			// Iterate over each messaging event
			pageEntry.messaging.forEach(function (messagingEvent) {
				if (messagingEvent.optin) {
					receivedAuthentication(messagingEvent);
				} else if (messagingEvent.message) {
					receivedMessage(messagingEvent);
				} else if (messagingEvent.delivery) {
					receivedDeliveryConfirmation(messagingEvent);
				} else if (messagingEvent.postback) {
					receivedPostback(messagingEvent);
				} else if (messagingEvent.read) {
					receivedMessageRead(messagingEvent);
				} else if (messagingEvent.account_linking) {
					receivedAccountLink(messagingEvent);
				} else {
					console.log("Webhook received unknown messagingEvent: ", messagingEvent);
				}
			});
		});

		// Assume all went well.
		// You must send back a 200, within 20 seconds
		res.sendStatus(200);
	}
});





function receivedMessage(event) {

	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfMessage = event.timestamp;
	var message = event.message;

	if (!sessionIds.has(senderID)) {
		sessionIds.set(senderID, uuid.v1());
	}
	//console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
	//console.log(JSON.stringify(message));

	var isEcho = message.is_echo;
	var messageId = message.mid;
	var appId = message.app_id;
	var metadata = message.metadata;

	// You may get a text or attachment but not both
	var messageText = message.text;
	var messageAttachments = message.attachments;
	var quickReply = message.quick_reply;

	if (isEcho) {
		handleEcho(messageId, appId, metadata);
		return;
	} else if (quickReply) {
		handleQuickReply(senderID, quickReply, messageId);
		return;
	}


	if (messageText) {
		//send message to api.ai
		sendToApiAi(senderID, messageText);
	} else if (messageAttachments) {
		handleMessageAttachments(messageAttachments, senderID);
	}
}


function handleMessageAttachments(messageAttachments, senderID){
	//for now just reply
	sendTextMessage(senderID, "Attachment received. Thank you.");	
}

function handleQuickReply(senderID, quickReply, messageId) {
	var quickReplyPayload = quickReply.payload;
	console.log("Quick reply for message %s with payload %s", messageId, quickReplyPayload);
	//send payload to api.ai
	sendToApiAi(senderID, quickReplyPayload);
}

//https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-echo
function handleEcho(messageId, appId, metadata) {
	// Just logging message echoes to console
	console.log("Received echo for message %s and app %d with metadata %s", messageId, appId, metadata);
}

function refreshToken() {
	var request = require('request');
				request({
					url:'https://www.googleapis.com/oauth2/v4/token?&client_id=784777536708-g14fu1msh4a1a25435i3j4n85urdsjjr.apps.googleusercontent.com&refresh_token=1/UI3EJtLwGyLIkGBAvHkaYfFP8_9hJG9W0XVqpkUn1CFuY8oFkAYMPCwozxjEfb6u&client_secret=ov6NivbTd6JIupxIm-0b82Ij&grant_type=refresh_token',
					method:"POST",
					headers:{
						content_type: 'application/x-www-form-urlencoded'
					}
				},	function(error, response, body) {
					if (!error && response.statusCode == 200){
						let code = JSON.parse(body);
						if(code.hasOwnProperty("access_token")) {
							codes = `${ code ["access_token"] }`;
							console.log(codes);
						}
					} else {
						console.error(response.error);
					}
				});
			console.log("After Sleep"+ codes);
}

function getSchoolDay(sender, responseText) {
	var today = new Date();
	var tomorrow;
	today = today.toISOString();
	console.log("Date:" + today);
	request({
		url: "https://www.googleapis.com/calendar/v3/calendars/sas.edu.sg_59677quvvugr43j58tm4r23ang@group.calendar.google.com/events/?timeMin=" + today + "&maxResults=1&singleEvents=true&orderBy=startTime",
		method: "GET",
		headers: {
			Authorization: " Bearer " + codes,

		}
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log(body);
			let day = JSON.parse(body);
			let dayOfWeek = new Date(day["items"][0]["start"]["date"]).getDay();
			if(dayOfWeek == 0) dayOfWeek = "Sunday"; if(dayOfWeek == 1) dayOfWeek = "Monday"; if(dayOfWeek == 2) dayOfWeek = "Tuesday"; if(dayOfWeek == 3) dayOfWeek = "Wednesday"; if(dayOfWeek == 4) dayOfWeek = "Thursday"; if(dayOfWeek == 5) dayOfWeek = "Friday"; if(dayOfWeek == 6) dayOfWeek = "Saturday";
			let response = `It is a${responseText} ${day["items"][0]["summary"]} on ${dayOfWeek}, ${day["items"][0]["start"]["date"]}. Make sure to pack your bag for ${day["items"][0]["summary"]}!`;
			sendTextMessage(sender, response);
			console.log(codes);
		} else {
			console.error(response.error);
		}
	}); 
}

function getSchoolDayAnotherDay(sender, responseText, dateOfDay) {
	var today = new Date();
	var tomorrow;
	today = today.toISOString();
	console.log("Date:" + today);
	request({
		url: "https://www.googleapis.com/calendar/v3/calendars/sas.edu.sg_59677quvvugr43j58tm4r23ang@group.calendar.google.com/events/?timeMin=" + dateOfDay + "&maxResults=1&singleEvents=true&orderBy=startTime",
		method: "GET",
		headers: {
			Authorization: " Bearer " + codes,

		}
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log(body);
			let day = JSON.parse(body);
			let dayOfWeek = new Date(day["items"][0]["start"]["date"]).getDay();
			if(dayOfWeek == 0) dayOfWeek = "Sunday"; if(dayOfWeek == 1) dayOfWeek = "Monday"; if(dayOfWeek == 2) dayOfWeek = "Tuesday"; if(dayOfWeek == 3) dayOfWeek = "Wednesday"; if(dayOfWeek == 4) dayOfWeek = "Thursday"; if(dayOfWeek == 5) dayOfWeek = "Friday"; if(dayOfWeek == 6) dayOfWeek = "Saturday";
			let response = `It is a${responseText} ${day["items"][0]["summary"]} on ${dayOfWeek}, ${day["items"][0]["start"]["date"]} Did you pack your bag right?`;
			sendTextMessage(sender, response);
			console.log(codes);
		} else {
			console.error(response.error);
		}
	});
}

function getHoliday(sender, responseText, q1) {
	var today = new Date();
	today = today.toISOString();
	console.log("Date:" + today);
	request({
		url: "https://www.googleapis.com/calendar/v3/calendars/tdds37nnse3d1u5epd2hu83464@group.calendar.google.com/events/?timeMin=" + today + "&maxResults=1&singleEvents=true&orderBy=startTime&q=" + "holiday",
		method: "GET",
		headers: {
			Authorization: " Bearer " + codes,
		}
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log(body);
			let day = JSON.parse(body);
			let start = new Date(`${day["items"][0]["start"]["date"]}`);
			let end = new Date(`${day["items"][0]["end"]["date"]}`);
			var timeDiff = Math.abs(end.getTime() - start.getTime());
			var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
			var daysTillBreak = Math.ceil((Math.abs((new Date()).getTime() - start.getTime())/(1000 * 3600 * 24)));
			if (diffDays <= 1) {
				let responses = `It's${responseText} ${day["items"][0]["summary"]} on ${day["items"][0]["start"]["date"]}`;
				sendTextMessage(sender, responses);
			}
			else {
				let responses = `It's${responseText} ${day["items"][0]["summary"]} from ${day["items"][0]["start"]["date"]} to ${day["items"][0]["end"]["date"]} Only ${daysTillBreak} days to go! Keep at it!`;
				sendTextMessage(sender, responses);
			}

			console.log(codes);
		} else {
			console.error(response.error);
		}
	});
}

function handleApiAiAction(sender, action, responseText, contexts, parameters) {
	switch (action) {
		case 'fetch_homework' :
		var user;
		request({
			uri: 'https://graph.facebook.com/v2.7/' + sender.id,
			qs: {
				access_token: config.FB_PAGE_TOKEN
			}
	
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
	
				user = JSON.parse(body);
	
				if (user.first_name) {
					console.log("FB user: %s %s, %s",
						user.first_name, user.last_name, user.gender);
	
					//sendTextMessage(userId, "Welcome " + user.first_name + '! I am Eddy the Eagle, the SAS Student Chatbot. Ask me any school related queries! (e.g. School Days, Holidays, Homework Assignments) I will probably have an answer :)');
				} else {
					console.log("Cannot get data for fb user with id",
						userId);
				}
			} else {
				console.error(response.error);
			}
	
		});

			request({
				url: "https://api.schoology.com/v1/search?keywords=" + user.first_name + "+" + user.last_name + "&type=user",
				method: "GET",
				headers: {
					authorization: "OAuth realm=\"https://api.schoology.com/\",oauth_consumer_key=\"6c0e7eaabd179fc62c025411bbc62df90596a2a38\",oauth_token=\"\",oauth_nonce=\"596b43992ed54\",oauth_signature_method=\"PLAINTEXT\",oauth_timestamp=\"" + Math.ceil((new Date().getTime()/1000)) + "\",oauth_version=\"1.0\",oauth_signature=\"7f9117828e3c1aef6fc25d09f8347319%26\"",
		
				}
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					sendTextMessage(sender, body);
					console.log(body);
					console.log("hw fetch");

				} else {
					console.error(response.error);
				}
			});
		break;
		case 'find_school_day' :
			refreshToken();
			console.log("DAY: " + parameters["date"] + parameters.date);
			if(parameters["date"])
				getSchoolDayAnotherDay(sender, responseText, (parameters["date"] + "T11:30:56.784Z"));
			else 
				getSchoolDay(sender, responseText);
		break;
		
		case 'fetch_holidays' : 
			refreshToken();
			var q1 = "holiday"
			console.log(parameters.holiday)
			if (parameters["holiday"] != "") {
				q1 = parameters["holiday"];
				console.log("HOLIDAY:" + `${parameters["holiday"]}`)
			}
			getHoliday(sender, responseText, q1);
		break;
		case 'fetch_SAT_ACT' :
			refreshToken();
			var today = new Date();
			today = today.toISOString();
			console.log("Date:" + today);
			request({
				url: "https://www.googleapis.com/calendar/v3/calendars/sas.edu.sg_63hhdl0689bleqeuqhee37q688@group.calendar.google.com/events/?timeMin=" + today + "&maxResults=1&singleEvents=true&orderBy=startTime&q=" + parameters["Tests"],
				method:"GET",
				headers:{
					Authorization: " Bearer " + codes,
					
				}
				},	function(error, response, body) {
					if (!error && response.statusCode == 200){
						let day = JSON.parse(body);
						if (parameters["Tests"] === "ACT") {
							let buttons = [
								{
									"type": "web_url",
									"url": "http://www.act.org/content/act/en/products-and-services/the-act/registration.html#scrollNav-2-2",
									"title": "All ACT Testing Dates"
								},
							]
							sendButtonMessage(sender, `${responseText} The Next ${ day ["items"] [0] ["summary"]} is on ${day ["items"] [0] ["start"] ["date"] }`, buttons);
						}
						else {
							let buttons = [
								{
									"type": "web_url",
									"url": "https://collegereadiness.collegeboard.org/sat/register/international",
									"title": "All SAT Testing Dates"
								},
							]
							sendButtonMessage(sender, `${responseText} The Next ${ day ["items"] [0] ["summary"]} is on ${day ["items"] [0] ["start"] ["date"] }`, buttons);
							}
						}
					else {
						console.error(response.error);
					}		
						
					console.log(codes);

				});	
		break;
		case 'fetch_summer_break' :
				sendTextMessage(sender, "Ooh don't get too far ahead of yourself, make sure to do well at school :) Summer break is from the 9th of June.")
		break;
		case 'fetch_general_event':
			refreshToken();
			var today = new Date();
			today = today.toISOString();
			console.log("Date:" + today);
			request({
				url: "https://www.googleapis.com/calendar/v3/calendars/sas.edu.sg_63hhdl0689bleqeuqhee37q688@group.calendar.google.com/events/?timeMin=" + today + "&maxResults=1&singleEvents=true&orderBy=startTime&q=" + parameters["any"],
				method:"GET",
				headers:{
					Authorization: " Bearer " + codes,
					
				}
				},	function(error, response, body) {
					if (!error && response.statusCode == 200){
						console.log(body);
						let day = JSON.parse(body);
						if (day["items"][0] !== undefined) {
							let start = new Date(`${day["items"][0]["start"]["date"]}`);
							let end = new Date(`${day["items"][0]["end"]["date"]}`);
							var timeDiff = Math.abs(end.getTime() - start.getTime());
							var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
							if (diffDays = 0) {
								let responses = `invalid event`;
							}
						
							if (diffDays <= 1) {
								let responses = `${responseText} ${day["items"][0]["summary"]} on ${day["items"][0]["start"]["date"]}`;
								sendTextMessage(sender, responses);
							}
							else {
								let responses = `${responseText} ${day["items"][0]["summary"]} from ${day["items"][0]["start"]["date"]} to ${day["items"][0]["end"]["date"]}`;
								sendTextMessage(sender, responses);
							}	
								console.log(codes);
							}
						else {
							sendTextMessage(sender, "Sorry, I could not find this event.")
						} 
						}
						else {	
							console.error(response.error);
						}
				});
		break;

		case 'fetch_dress':
			refreshToken();
			var today = new Date();
			today = today.toISOString();
			console.log("Date:" + today);
			console.log(parameters["dress-day"]);
			request({
				url: "https://www.googleapis.com/calendar/v3/calendars/sas.edu.sg_63hhdl0689bleqeuqhee37q688@group.calendar.google.com/events/?timeMin=" + today + "&maxResults=1&singleEvents=true&orderBy=startTime&q=" + parameters["dress-day"],
				method: "GET",
				headers: {
					Authorization: " Bearer " + codes,

				}
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					console.log(body);
					let day = JSON.parse(body);
					let responses = `${responseText} ${day["items"][0]["summary"]}) on ${day["items"][0]["start"]["date"]}`;
					sendTextMessage(sender, responses);
					}
				 else {
					console.error(response.error);
				}
			});
			break;
		default:
			//unhandled action, just send back the text
			sendTextMessage(sender, responseText + " ");

		}
}

function handleMessage(message, sender) {
	switch (message.type) {
		case 0: //text
			sendTextMessage(sender, message.speech);
			break;
		case 2: //quick replies
			let replies = [];
			for (var b = 0; b < message.replies.length; b++) {
				let reply =
				{
					"content_type": "text",
					"title": message.replies[b],
					"payload": message.replies[b]
				}
				replies.push(reply);
			}
			sendQuickReply(sender, message.title, replies);
			break;
		case 3: //image
			sendImageMessage(sender, message.imageUrl);
			break;
		case 4:
			// custom payload
			var messageData = {
				recipient: {
					id: sender
				},
				message: message.payload.facebook

			};

			callSendAPI(messageData);

			break;
	}
}


function handleCardMessages(messages, sender) {

	let elements = [];
	for (var m = 0; m < messages.length; m++) {
		let message = messages[m];
		let buttons = [];
		for (var b = 0; b < message.buttons.length; b++) {
			let isLink = (message.buttons[b].postback.substring(0, 4) === 'http');
			let button;
			if (isLink) {
				button = {
					"type": "web_url",
					"title": message.buttons[b].text,
					"url": message.buttons[b].postback
				}
			} else {
				button = {
					"type": "postback",
					"title": message.buttons[b].text,
					"payload": message.buttons[b].postback
				}
			}
			buttons.push(button);
		}


		let element = {
			"title": message.title,
			"image_url":message.imageUrl,
			"subtitle": message.subtitle,
			"buttons": buttons
		};
		elements.push(element);
	}
	sendGenericMessage(sender, elements);
}


function handleApiAiResponse(sender, response) {
	let responseText = response.result.fulfillment.speech;
	let responseData = response.result.fulfillment.data;
	let messages = response.result.fulfillment.messages;
	let action = response.result.action;
	let contexts = response.result.contexts;
	let parameters = response.result.parameters;

	sendTypingOff(sender);

	if (isDefined(messages) && (messages.length == 1 && messages[0].type != 0 || messages.length > 1)) {
		let timeoutInterval = 1100;
		let previousType ;
		let cardTypes = [];
		let timeout = 0;
		for (var i = 0; i < messages.length; i++) {

			if ( previousType == 1 && (messages[i].type != 1 || i == messages.length - 1)) {

				timeout = (i - 1) * timeoutInterval;
				setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
				cardTypes = [];
				timeout = i * timeoutInterval;
				setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
			} else if ( messages[i].type == 1 && i == messages.length - 1) {
				cardTypes.push(messages[i]);
                		timeout = (i - 1) * timeoutInterval;
                		setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
                		cardTypes = [];
			} else if ( messages[i].type == 1 ) {
				cardTypes.push(messages[i]);
			} else {
				timeout = i * timeoutInterval;
				setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
			}

			previousType = messages[i].type;

		}
	} else if (responseText == '' && !isDefined(action)) {
		//api ai could not evaluate input.
		console.log('Unknown query' + response.result.resolvedQuery);
		sendTextMessage(sender, "I'm not sure what you want. Can you be more specific?");
	} else if (isDefined(action)) {
		handleApiAiAction(sender, action, responseText, contexts, parameters);
	} else if (isDefined(responseData) && isDefined(responseData.facebook)) {
		try {
			console.log('Response as formatted message' + responseData.facebook);
			sendTextMessage(sender, responseData.facebook);
		} catch (err) {
			sendTextMessage(sender, err.message);
		}
	} else if (isDefined(responseText)) {

		sendTextMessage(sender, responseText);
	}
}

function sendToApiAi(sender, text) {

	sendTypingOn(sender);
	let apiaiRequest = apiAiService.textRequest(text, {
		sessionId: sessionIds.get(sender)
	});

	apiaiRequest.on('response', (response) => {
		if (isDefined(response.result)) {
			handleApiAiResponse(sender, response);
		}
	});

	apiaiRequest.on('error', (error) => console.error(error));
	apiaiRequest.end();
}




function sendTextMessage(recipientId, text) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: text
		}
	}
	callSendAPI(messageData);
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId, imageUrl) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "image",
				payload: {
					url: imageUrl
				}
			}
		}
	};

	callSendAPI(messageData);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "image",
				payload: {
					url: config.SERVER_URL + "/assets/instagram_logo.gif"
				}
			}
		}
	};

	callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "audio",
				payload: {
					url: config.SERVER_URL + "/assets/sample.mp3"
				}
			}
		}
	};

	callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 * example videoName: "/assets/allofus480.mov"
 */
function sendVideoMessage(recipientId, videoName) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "video",
				payload: {
					url: config.SERVER_URL + videoName
				}
			}
		}
	};

	callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 * example fileName: fileName"/assets/test.txt"
 */
function sendFileMessage(recipientId, fileName) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "file",
				payload: {
					url: config.SERVER_URL + fileName
				}
			}
		}
	};

	callSendAPI(messageData);
}



/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId, text, buttons) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "button",
					text: text,
					buttons: buttons
				}
			}
		}
	};

	callSendAPI(messageData);
}


function sendGenericMessage(recipientId, elements) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "generic",
					elements: elements
				}
			}
		}
	};

	callSendAPI(messageData);
}


function sendReceiptMessage(recipientId, recipient_name, currency, payment_method,
							timestamp, elements, address, summary, adjustments) {
	// Generate a random receipt ID as the API requires a unique ID
	var receiptId = "order" + Math.floor(Math.random() * 1000);

	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "receipt",
					recipient_name: recipient_name,
					order_number: receiptId,
					currency: currency,
					payment_method: payment_method,
					timestamp: timestamp,
					elements: elements,
					address: address,
					summary: summary,
					adjustments: adjustments
				}
			}
		}
	};

	callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId, text, replies, metadata) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: text,
			metadata: isDefined(metadata)?metadata:'',
			quick_replies: replies
		}
	};

	callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {

	var messageData = {
		recipient: {
			id: recipientId
		},
		sender_action: "mark_seen"
	};

	callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {


	var messageData = {
		recipient: {
			id: recipientId
		},
		sender_action: "typing_on"
	};

	callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {


	var messageData = {
		recipient: {
			id: recipientId
		},
		sender_action: "typing_off"
	};

	callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment: {
				type: "template",
				payload: {
					template_type: "button",
					text: "Welcome. Link your account.",
					buttons: [{
						type: "account_link",
						url: config.SERVER_URL + "/authorize"
          }]
				}
			}
		}
	};

	callSendAPI(messageData);
}


function greetUserText(userId) {
	//first read user firstname
	request({
		uri: 'https://graph.facebook.com/v2.7/' + userId,
		qs: {
			access_token: config.FB_PAGE_TOKEN
		}

	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {

			var user = JSON.parse(body);

			if (user.first_name) {
				console.log("FB user: %s %s, %s",
					user.first_name, user.last_name, user.gender);

				sendTextMessage(userId, "Welcome " + user.first_name + '! I am Eddy the Eagle, the SAS Student Chatbot. Ask me any school related queries! (e.g. School Days, Holidays, Homework Assignments) I will probably have an answer :)');
			} else {
				console.log("Cannot get data for fb user with id",
					userId);
			}
		} else {
			console.error(response.error);
		}

	});
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {
			access_token: config.FB_PAGE_TOKEN
		},
		method: 'POST',
		json: messageData

	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var recipientId = body.recipient_id;
			var messageId = body.message_id;

			if (messageId) {
				console.log("Successfully sent message with id %s to recipient %s",
					messageId, recipientId);
			} else {
				console.log("Successfully called Send API for recipient %s",
					recipientId);
			}
		} else {
			console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
		}
	});
}



/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfPostback = event.timestamp;

	// The 'payload' param is a developer-defined field which is set in a postback 
	// button for Structured Messages. 
	var payload = event.postback.payload;

	switch (payload) {
		case 'GET_STARTED':
			greetUserText(senderID);
			break;
		case 'SCHOOL_DAY':
			refreshToken();
			getSchoolDay(senderID, "");
		break;
		case 'SCHOOL_HOLIDAY':
			refreshToken();
			getHoliday(senderID, "", "Holiday");
		break;
		case 'TESTS':
			sendTextMessage(senderID, "SAT or ACT?");
			break;
		default:
			//unindentified payload
			sendTextMessage(senderID, "I does not do understanding of your message");
			break;

	}

	console.log("Received postback for user %d and page %d with payload '%s' " +
		"at %d", senderID, recipientID, payload, timeOfPostback);

}


/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;

	// All messages before watermark (a timestamp) or sequence have been seen.
	var watermark = event.read.watermark;
	var sequenceNumber = event.read.seq;

	console.log("Received message read event for watermark %d and sequence " +
		"number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;

	var status = event.account_linking.status;
	var authCode = event.account_linking.authorization_code;

	console.log("Received account link event with for user %d with status %s " +
		"and auth code %s ", senderID, status, authCode);
}

/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var delivery = event.delivery;
	var messageIDs = delivery.mids;
	var watermark = delivery.watermark;
	var sequenceNumber = delivery.seq;

	if (messageIDs) {
		messageIDs.forEach(function (messageID) {
			console.log("Received delivery confirmation for message ID: %s",
				messageID);
		});
	}

	console.log("All message before %d were delivered.", watermark);
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfAuth = event.timestamp;

	// The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
	// The developer can set this to an arbitrary value to associate the 
	// authentication callback with the 'Send to Messenger' click event. This is
	// a way to do account linking when the user clicks the 'Send to Messenger' 
	// plugin.
	var passThroughParam = event.optin.ref;

	console.log("Received authentication for user %d and page %d with pass " +
		"through param '%s' at %d", senderID, recipientID, passThroughParam,
		timeOfAuth);

	// When an authentication is received, we'll send a message back to the sender
	// to let them know it was successful.
	sendTextMessage(senderID, "Authentication successful");
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
	var signature = req.headers["x-hub-signature"];

	if (!signature) {
		throw new Error('Couldn\'t validate the signature.');
	} else {
		var elements = signature.split('=');
		var method = elements[0];
		var signatureHash = elements[1];

		var expectedHash = crypto.createHmac('sha1', config.FB_APP_SECRET)
			.update(buf)
			.digest('hex');

		if (signatureHash != expectedHash) {
			throw new Error("Couldn't validate the request signature.");
		}
	}
}

function isDefined(obj) {
	if (typeof obj == 'undefined') {
		return false;
	}

	if (!obj) {
		return false;
	}

	return obj != null;
}

// Spin up the server
app.listen(app.get('port'), function () {
	console.log('running on port', app.get('port'))
})