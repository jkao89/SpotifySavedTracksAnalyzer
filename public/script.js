
/**
 * Obtains parameters from the hash of the URL
 * @return Object
 */
function getHashParams() {
  var hashParams = {};
  var e, r = /([^&;=]+)=?([^&;]*)/g,
	  q = window.location.hash.substring(1);
  while ( e = r.exec(q)) {
	 hashParams[e[1]] = decodeURIComponent(e[2]);
  }
  return hashParams;
}

// User profile handlebar template
var userProfileSource = document.getElementById('user-profile-template').innerHTML,
	userProfileTemplate = Handlebars.compile(userProfileSource),
	userProfilePlaceholder = document.getElementById('user-profile');

// User tracks handlebar template
var tracksSummarySource = document.getElementById('tracks-summary-template').innerHTML,
	tracksSummaryTemplate = Handlebars.compile(tracksSummarySource),
	tracksSummaryPlaceholder = document.getElementById('tracks-summary');

// Retrieve the hash parameters
var params = getHashParams();

// Assign token values from hash parameters
var access_token = params.access_token,
	refresh_token = params.refresh_token,
	error = params.error;

var tracksData = { items: []};	// For populating Handlebars template
var songStrings;	// String of songIDs, for audio feature retrieval
var artistString;	// String of artistIDs, for artists object retrieval
var artistGenres = {};	// Genres of artists, keyed by artist ID
var songCount = 0;		// Number of songs retrieved so far, used for offset 
var keyConversion = {0: "C", 1: "C#", 2: "D", 3: "D#", 4: "E", 5: "F", 6: "F#",
							  7: "G", 8: "G#", 9: "A", 10: "A#", 11: "B"};

Handlebars.registerHelper("toUpperCase", function(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper("convertKey", function(num) {
			return keyConversion[num];
		});

if (error) {
  alert('There was an error during the authentication');
} else {
  if (access_token) {

	// Get user information
	$.ajax({
		url: 'https://api.spotify.com/v1/me',
		headers: {
		  'Authorization': 'Bearer ' + access_token
		},
		success: function(response) {
		  userProfilePlaceholder.innerHTML = userProfileTemplate(response);
		  $('#login').hide();
		  $('#loggedin').show();
		  retrieveTrackData();		// Retrieve user's saved tracks
		}
	});
	
  } else {
  // render initial screen
  $('#login').show();
  $('#loggedin').hide();
  }
}

	
function retrieveTrackData() {	
	var songIDs = []; 		// List of song IDs	
	var artistIDs = [];		// List of artist IDs
	var artistRequests = [];	// GET requests for artist, for retrieving genre
	songStrings = "";			// Initialize strings to be empty
	artistStrings = "";
	// Send GET request to Spotify Web API for saved tracks
	$.ajax({
		url: 'https://api.spotify.com/v1/me/tracks',
		headers: {
		  'Authorization': 'Bearer ' + access_token
		},
		data: {
			limit: 50,
			offset: songCount
		},
		success: function(response) {

			// Iterate through all tracks returned in the response
			for(var i = 0; i < response.items.length; i++) {
				songIDs[i] = response.items[i].track.id;					// Add tracks IDs to songIDs array
				tracksData.items[songCount + i] = response.items[i];		// Copy current set of tracks data
				
				// For each track, add all artist IDs to artistIDs array
				for(var j = 0; j < response.items[i].track.artists.length; j++) {
					artistIDs.push(response.items[i].track.artists[j].id);
				}
			}	
			
			songStrings = "/?ids=" + songIDs.join();		// Concatenate song IDs
		
			// Split artist IDs into groups of 50
			for (var i = 0; i < artistIDs.length;) {
				
				// If there are more than 50 artists left to retrieve
				if ((artistIDs.length) - i > 50) {
					artistString = "?ids=" + artistIDs.slice(i, i+50).join();
					i += 50;
				// If less than 50 artists to retrieve
				} else {
					artistString = "?ids=" + artistIDs.slice(i);
					i = artistIDs.length;
				}
				
				// Push GET request for artists onto artistRequests array
				artistRequests.push(
					$.ajax({
						url: 'https://api.spotify.com/v1/artists/'+artistString,
						headers: {
							'Authorization': 'Bearer ' + access_token
						}
					}
				));
			}
			
			// Get audio features for this set of tracks
			var trackFeatures = $.ajax({
					url: 'https://api.spotify.com/v1/audio-features'+songStrings,
					headers: {
					  'Authorization': 'Bearer ' + access_token
				}
			});
		
			// When audio feature and artist requests are done			
			$.when(trackFeatures, ...artistRequests).done(function() {					
					
				// Copy track features into tracksData object
				for(var i = 0; i < response.items.length; i++) {
					tracksData.items[songCount + i].audio_features = trackFeatures.responseJSON.audio_features[i];
				}
				
				// Copy artist genres into artistGenres object, keyed by artist ID
				for(var j = 0; j < artistRequests.length; j++) {
					for (var k = 0; k < artistRequests[j].responseJSON.artists.length; k++) {
						var tempID = artistRequests[j].responseJSON.artists[k].id;    
						artistGenres[tempID] = artistRequests[j].responseJSON.artists[k].genres;
					}
				}
				songCount += response.items.length;			// Update song count
				if (response.items.length == 50) {			// If there are more tracks to retrieve
					retrieveTrackData();					// Call function again
				} else {				
					tracksSummaryPlaceholder.innerHTML = tracksSummaryTemplate(tracksData);		// Populate template with tracksData
					var artistDivs = $(".artist-names").children();
					$.each(artistDivs, function() {
						var genreNames = artistGenres[this.id];
						genreNames = genreNames.join("<br>");
						this.title = genreNames;
						});
					$('[data-toggle="tooltip"]').tooltip({html:true});	
				}
			});
				
		}
	});
}


