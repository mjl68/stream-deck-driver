'use strict';

// Packages
const path = require('path');
const sharp = require('sharp'); 
const streamDeck = require('elgato-stream-deck');
var curl = require('curlrequest');

//=============================== CONFIGURATION ===============================
// Set to deck number with cards you want to assign to buttons within 
// card folders
const ARKHAMDB_PLAYER_DECK_ID = 1761;
const ARKHAMDB_API_DECK_URL = 'https://arkhamdb.com/api/public/decklist/'
const ARKHAMDB_EMPTY_CARD_ID = 0;

// Number of buttons on stream deck
const STREAMDECK_BUTTONS_PER_FOLDER = 15;
// Reserving button 4 to be the 'main folder index'. Never assign button 4 to be a folder
const STREAM_DECK_MAIN_FOLDER_INDEX = 4;
// The key index of the "back" button when sub-page is open
const STREAMDECK_BACK_BUTTON_KEY_INDEX = 4;

const reservedFolderButtons = [STREAMDECK_BACK_BUTTON_KEY_INDEX];

const imageCacheDirectory = './imagecache';
const genericCardButtonIconFileName = 'icons/cardtemplate.png';

// Fill with lst of buttons in current StreamDeck configuration that open 
// folders. This is necessary to track which "page" the StreamDeck is currently
// on, e.g., the main page or a sub-page
const folderButtons = [5, 6, 7, 8, 9, 13, 14];

// Fill with buttons with folders that should have cards
const cardFolderButtons = [13, 14];

//=============================================================================

// Index of current active folder
var currentFolderIndex = STREAM_DECK_MAIN_FOLDER_INDEX;

// Array that will populated with card ids
var cardList = [];

// Array of folders 
//		index : button key index 
//		cards: list of card ids for folder
var cardFolders = [];

function loadDeck(callback) {
	var requestUrl = ARKHAMDB_API_DECK_URL + ARKHAMDB_PLAYER_DECK_ID + '.json';
	var options = {
		url: requestUrl, 
		verbose: true,
		stderr: true
	};

	curl.request(options, function (err, data) {
		var json = JSON.parse(data.toString());
		callback(json)
	});
}

function initializeCardFolders() {
	for (var i = 0; i < cardFolderButtons.length; i++) {
		cardFolders[cardFolderButtons[i]] = [];

		for (var j = 0; j < STREAMDECK_BUTTONS_PER_FOLDER; j++) {
			if (reservedFolderButtons.indexOf(j) == -1) {
				cardFolders[cardFolderButtons[i]][j] = ARKHAMDB_EMPTY_CARD_ID;
			}
		}
	}
}

function cacheKeyImageWithTextOverlay(iconImageFileName, overlayText, outputImageFileName) {
	var image = sharp(path.resolve(__dirname, iconImageFileName));
	image.flatten(); // Eliminate alpha channel, if any.
	image.resize(streamDeck.ICON_SIZE); // Scale down to the right size, cropping if necessary.
	let textSVG = `<svg width="72px" height="72px" viewBox="0 0 72 72"><text x="5" y="45" style="font-size:18px;fill:white;stroke:grey;stroke-width:1;">` + overlayText + `</text></svg>`;
	image.overlayWith(new Buffer(textSVG));
	image.toFile(outputImageFileName);
	console.log("wrote: %s", outputImageFileName);
}

function populateFoldersWithCards(cardList) {

	initializeCardFolders();

	var cardsToAdd = cardList.slice()
	//console.log(cardsToAdd);
 	for (var folderIndex = 0; folderIndex < cardFolders.length && cardsToAdd.length > 0; folderIndex++) {
 		for (var keyIndex in cardFolders[folderIndex]) {
 			if (cardsToAdd.length == 0) {
 				break;
 			}

 			var cardId = cardsToAdd.shift();
			cardFolders[folderIndex][keyIndex] = cardId;

			// TODONOW DRY
 			var cachedKeyIconFileName = imageCacheDirectory + '/' + 'button_' + folderIndex + '_' + keyIndex + '.png';
			cacheKeyImageWithTextOverlay(genericCardButtonIconFileName, cardId, cachedKeyIconFileName);
 		}
	}

	//console.log(cardFolders);
}

// Set a SteamDeck button image
function setKeyImage(keyIndex, keyImageFileName) {
	var outputImage = sharp(path.resolve(__dirname, keyImageFileName));
	outputImage.resize(streamDeck.ICON_SIZE); // Scale down to the right size, cropping if necessary.
	outputImage.flatten(); // Eliminate alpha channel, if any.
	outputImage.raw(); // Give us uncompressed RGB
	outputImage.toBuffer()
   			   .then(buffer => {
	   			   	streamDeck.fillImage(keyIndex, buffer);
				})
			   .catch(err => {
					console.log('----- Error ----');
					console.error(err);
				});
}

function displayCardsInCurrentFolder()
{
	for (var keyIndex in cardFolders[currentFolderIndex]) {

		var cardId = cardFolders[currentFolderIndex][keyIndex];
		// TODONOW DRY
		var cachedKeyIconFileName = imageCacheDirectory + '/' + 'button_' + currentFolderIndex + '_' + keyIndex + '.png';
		console.log("DISPLAYING CARD: folderId = %d keyIndex = %d cardId = %d cachedIconImage=%s", currentFolderIndex, keyIndex, cardId, cachedKeyIconFileName);
		setKeyImage(keyIndex, cachedKeyIconFileName);
	}
}

/*  Handling key presses
 */
streamDeck.on('up', selectedKeyIndex => {
	if (currentFolderIndex == STREAM_DECK_MAIN_FOLDER_INDEX) {
		// If button for sub-folder in main folder was opened then populate it with buttons
		// for the cards. Need to do it on a delay after StreamDeck software has finished
		// opening the folder.
		if (typeof cardFolders[selectedKeyIndex] !== 'undefined' && cardFolders[selectedKeyIndex] !== null) {
			currentFolderIndex = selectedKeyIndex;
			setTimeout(displayCardsInCurrentFolder, 500);
		}
	}
	else if (selectedKeyIndex == STREAMDECK_BACK_BUTTON_KEY_INDEX) {
		// Return to main folder
		currentFolderIndex = STREAM_DECK_MAIN_FOLDER_INDEX;
	} else {
		// Do action for button in card folder
		pass;
	}

    console.log('current folder index: %d', currentFolderIndex);
});

streamDeck.on('error', error => {
    console.error(error);
});

//============================ Main =================================

// Load the cards in the current deck into the deck list
loadDeck(function(json)	{
	if (json.hasOwnProperty('slots')) {
		var slots = json['slots'];
		for (var card in slots)
		{
			cardList.push(card);
		}
	}

	cardList.sort(function (card1, card2) {
		return card1 - card2;
	});

	populateFoldersWithCards(cardList);
});