

var AWS = require('aws-sdk');
AWS.config.region = "us-east-1";
let docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = function (event, context) {
	try {
		console.log("event.session.application.applicationId=" + event.session.application.applicationId);
		if (event.session.new) {
			onSessionStarted({ requestId: event.request.requestId }, event.session);
		}

		if (event.request.type === "LaunchRequest") {
			onLaunch(event.request,
				event.session,
				function callback(sessionAttributes, speechletResponse) {
					context.succeed(buildResponse(sessionAttributes, speechletResponse));
				});
		} else if (event.request.type === "IntentRequest") {
			onIntent(event.request,
				event.session,
				function callback(sessionAttributes, speechletResponse) {
					context.succeed(buildResponse(sessionAttributes, speechletResponse));
				});
		} else if (event.request.type === "SessionEndedRequest") {
			onSessionEnded(event.request, event.session);
			context.succeed();
		}
	} catch (e) {
		context.fail("Exception: " + e);
	}
};

function onSessionStarted(sessionStartedRequest, session) {
	console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId + ", sessionId=" + session.sessionId);
}

function onLaunch(launchRequest, session, callback) {
	console.log("onLaunch requestId=" + launchRequest.requestId + ", sessionId=" + session.sessionId);
	getWelcomeResponse(callback);
}

function onIntent(intentRequest, session, callback) {
	console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId);

	var intent = intentRequest.intent,
		intentName = intentRequest.intent.name;

	// Dispatch to your skill's intent handlers
	if ("Efficiency" === intentName) {
		effiencyIntent(intent, session, callback);
		//sectorIntent(intent, session, callback);
	} else if ("Sprinklers" === intentName) {
		sprinklerIntent(intent, session, callback);
	} else if ("Sectors" === intentName) {
		sectorIntent(intent, session, callback);
	} else if ("Sandstorm" === intentName) {
		sandstormIntent(intent, session, callback);
	} else if ("AMAZON.HelpIntent" === intentName) {
		getWelcomeResponse(callback);
	} else if ("AMAZON.StopIntent" === intentName || "AMAZON.CancelIntent" === intentName || "Noop" === intentName) {
		handleSessionEndRequest(callback);
	} else {
		throw "Invalid intent";
	}
}

function onSessionEnded(sessionEndedRequest, session) {
	console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId + ", sessionId=" + session.sessionId);
}

function getWelcomeResponse(callback) {
	// If we wanted to initialize the session to have some attributes we could add those here.
	var sessionAttributes = {};
	var cardTitle = "Welcome";
	var speechOutput = "Welcome to Las Vegas Powergrid " +
		"How can I help today?";

	// If the user either does not reply to the welcome message or says something that is not
	// understood, they will be prompted again with this text.
	var repromptText = "Thanks for checking in";
	var shouldEndSession = false;

	callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function effiencyIntent(intent, session, callback) {
	var cardTitle = "Power Grid Efficiency";
	var shouldEndSession = false;

	const params = { TableName: "solar-sectors" };
	docClient.scan(params, (err, data) => {
		if (err) callback({}, buildSpeechletResponse(cardTitle, err, null, shouldEndSession));

		var average = 0;

		for (let x of data.Items)
			average += x.Effeciency;
		let response = "The power grid is running at " + (average / 4) + " percent efficiency.";
		callback({}, buildSpeechletResponse(cardTitle, response, null, shouldEndSession));
	});
}

function sectorIntent(intent, session, callback) {
	var cardTitle = "Sector Performance";
	var shouldEndSession = false;

	const params = { TableName: "solar-sectors" };
	docClient.scan(params, (err, data) => {
		if (err) callback({}, buildSpeechletResponse(cardTitle, err, null, shouldEndSession));

		var response = "Here's how your sectors are performing: ";
		for (let x of data.Items) {
			response += x.Display + ": " + x.Effeciency + " percent";
			if (x.Effeciency < 80) {
				response += " efficiency, it requires maintenance. ";
			} else {
				response += x.ID === 3 ? " efficiency. " : ". ";
			}
		}
		callback({}, buildSpeechletResponse(cardTitle, response, null, shouldEndSession));
	});
}

function sprinklerIntent(intent, session, callback) {
	var cardTitle = "Turning on Sprinkers";
	var shouldEndSession = false;

	let params = {
		TableName: "solar-sectors",
		Key: { "ID": 1 },
		UpdateExpression: "set Effeciency = :eff",
		ExpressionAttributeValues: { ":eff": 88 },
		ReturnValues: "UPDATED_NEW"
	};

	docClient.update(params, (err, data) => {
		if (err) if (err) callback({}, buildSpeechletResponse(cardTitle, err, null, shouldEndSession));

		let response = "Turning on sprinklers in Sector D, for five minutes.";

		callback({}, buildSpeechletResponse(cardTitle, response, null, shouldEndSession));
	});
}
function sandstormIntent(intent, session, callback) {
	var cardTitle = "Performing Sandstorm";
	var shouldEndSession = false;

	let params = {
		TableName: "solar-sectors",
		Key: { "ID": 1 },
		UpdateExpression: "set Effeciency = :eff",
		ExpressionAttributeValues: { ":eff": 66 },
		ReturnValues: "UPDATED_NEW"
	};

	docClient.update(params, (err, data) => {
		if (err) if (err) callback({}, buildSpeechletResponse(cardTitle, err, null, shouldEndSession));

		let response = "Hold on, pouring sand onto Sector D.";

		callback({}, buildSpeechletResponse(cardTitle, response, null, shouldEndSession));
	});
}

function handleSessionEndRequest(callback) {
	var cardTitle = "Session Ended";
	var speechOutput = "Happy to help, till next time!";
	// Setting this to true ends the session and exits the skill.
	var shouldEndSession = true;

	callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}


// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
	return {
		outputSpeech: {
			type: "PlainText",
			text: output
		},
		card: {
			type: "Simple",
			title: "SessionSpeechlet - " + title,
			content: "SessionSpeechlet - " + output
		},
		reprompt: {
			outputSpeech: {
				type: "PlainText",
				text: repromptText
			}
		},
		shouldEndSession: shouldEndSession
	};
}

function buildResponse(sessionAttributes, speechletResponse) {
	return {
		version: "1.0",
		sessionAttributes: sessionAttributes,
		response: speechletResponse
	};
}

/************************* SOLAR SECTOR DB OPERATIONS *******************************************/
function getSolarSectors() {

}

function updateBadSector(id, eff) {

}
