var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/youtube-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'youtube-nodejs-quickstart-idat-fc-administracion.json';

var response;

// Load client secrets from a local file.
fs.readFile('client_secret_idat_cgt.json', function processClientSecrets(err, content) {
	if (err) {
		console.log('Error loading client secret file: ' + err);
		return;
	}

	// Authorize a client with the loaded credentials, then call the YouTube API.
	
	//var PlayListItemFields = 'Lista de Rep.,ID,Video,Publicado,Url\r\n';
	var AnalyticsFields = 'Lista de Rep.,ID,Video,Publicado,Url,Vistas,Promedio Vistas,Likes\r\n';
	
	fs.writeFile('Youtube.csv', AnalyticsFields, function(err){
		if(err) throw err;
	});
	
	authorize(JSON.parse(content), getPlayList);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
	var clientSecret = credentials.installed.client_secret;
	var clientId = credentials.installed.client_id;
	var redirectUrl = credentials.installed.redirect_uris[0];
	var auth = new googleAuth();
	var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			getNewToken(oauth2Client, callback);
		} else {
			oauth2Client.credentials = JSON.parse(token);
			callback(oauth2Client, null);
		}
	});
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
	var authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});

	console.log('Authorize this app by visiting this url: ', authUrl);

	fs.writeFile('url.txt', authUrl);

	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.question('Enter the code from that page here: ', function(code) {
		rl.close();
		oauth2Client.getToken(code, function(err, token) {
			if (err) {
				console.log('Error while trying to retrieve access token', err);
				return;
			}

			oauth2Client.credentials = token;

			storeToken(token);
			callback(oauth2Client);
		});
	});
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
	try {
		fs.mkdirSync(TOKEN_DIR);
	} catch (err) {
		if (err.code != 'EEXIST') {
			throw err;
		}
	}
	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  	console.log('Token stored to ' + TOKEN_PATH);
}


function query(auth, videID, callback) {
	var service = google.youtubeAnalytics('v1');

	service.reports.query({
		'auth' : auth,
		'ids' : 'channel==bLC7OrY5W7rVZSF2xpwfQg',
		'start-date' : '2017-09-10',
		'end-date' : '2017-10-25',
		'metrics' : 'views,averageViewPercentage,likes',
		'max-results' : '200',
        'sort' : '-views',
        'dimensions' : 'video',
        'filters' : 'video==' + videID,
        'start-index' : '1'
	}, function(err, result){
		if (err) console.log('Hubo un error: ' + err);

		if (typeof result !== 'undefined' && result !== null) {
			callback(result.rows);
		}
	});
}



function getPlayList(auth, pageToken) {

	var service = google.youtube('v3');

	service.playlists.list({
		auth : auth,
		part : 'snippet',
		mine : true, // Comentar si solo se quiere extraer de una lista de reproduccion especifica
		//id : 'PLxGpB5LAbUjRm-vORYT0oFyn9xl3zJNOI',  //Comentar si se quiere extraer la lista de reproduccion total
		maxResults : 50,
		pageToken : pageToken
	}, function(err, result) {
		if(err) {
			console.log('error: ' + err);
			return;
		}

		result.items.forEach(function(item){
			var id = item.id;

			PlayListItem(item.snippet.title, auth, id, null);
		});

		var nextPageToken = result.nextPageToken;

        if (typeof nextPageToken !== 'undefined') {
            getPlayList(auth, nextPageToken);
        }
	});
}


function PlayListItem(list, auth, id, nextPageToken) {
	var service = google.youtube('v3');

	service.playlistItems.list({
		auth : auth,
		part : 'snippet',
		playlistId : id,
		maxResults : 50,
		pageToken : nextPageToken
	}, function(err, result){

		if(err) {
			console.log('error: ' + err);
			return;
		}

		result.items.forEach(function(item){

			var lista_rep = list;
			var titulo = item.snippet.title;
			var published = item.snippet.publishedAt;
			var id = item.snippet.resourceId.videoId;
			var url = 'https://www.youtube.com/watch?v=' + item.snippet.resourceId.videoId;

			if(lista_rep.indexOf(',') > -1 || lista_rep.indexOf(', ') > -1) {
				lista_rep = lista_rep.split(',').join(' - ');
			}

			if(titulo.indexOf(',') > -1 || titulo.indexOf(', ') > -1) {
				titulo = titulo.split(',').join(' - ');
			}

			/********************* Cuando solo se tiene que extraer las listas de reproduccion ************************/

			/*fs.appendFile('Youtube.csv', lista_rep + ',' + id + ',' + titulo + ',' + published + ',' + url + '\r\n', function(err){
				if (err) throw err;
			});

			/********************************************************************************************************/
			/********************************** Cuando se quiere extraer las estadisticas de una lista especifica *****/
			
			var videoID = item.snippet.resourceId.videoId;
			query(auth, videoID, function(metrics){

				if (typeof metrics !== "undefined") {
					var fields = lista_rep + ',' + id + ',' + titulo + ',' + published + ',' + url + ',' + 
							metrics[0][1] + ',' + metrics[0][2] + ',' + metrics[0][3] + '\r\n';

					fs.appendFile('Youtube.csv', fields, function(err){
						if (err) throw err;
					});
				}
			});

			/*****************************************************************************************************/
		});

		var nextPageToken = result.nextPageToken;

        if (typeof nextPageToken !== 'undefined') {
            PlayListItem(list, auth, id, nextPageToken);
        }
	});
}