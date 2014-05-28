#!/usr/bin/env node

/* jslint es5: true */

var fs = require('fs'),
  express = require('express'),
  exphbs  = require(__dirname + '/../'), // "express3-handlebars"
  hbsHelpers = require(__dirname + '/hbs_helpers'),
  azure = require('azure'),
  moment = require('moment'),
  app = express(),
  hbs;

// create `ExpressHandlebars` instance with a default layout.
hbs = exphbs.create({
    defaultLayout: 'main',
    helpers: hbsHelpers,
    extname: '.hbs',
    partialsDir: __dirname + '/views/_partials/',
    layoutsDir: __dirname + '/views/_layouts/'
});

// register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');

app.use(require('cookie-parser')());
app.use(require('express-session')({ secret: '4d28b3a2-63ef-4d11-af60-dea75d342871' }));
app.use(require('body-parser')());

// serve static files first
app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next){
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.get('/',function(req,res) {
  res.render('landingpage');
});

app.post('/login', function (req, res) {
  req.session.azureAccount = { name: req.body.accountName, key: req.body.accountKey };
  try {
    getAzureBlobService(req)
    req.session.flash = {
      type: 'success',
      intro: 'Congratulations!',
      message: 'You have successfully logged in.',
    };
    return res.redirect('/account/' + req.session.azureAccount.name);
  } catch(err) {
    req.session.flash = {
      type: 'danger',
      intro: 'Validation error!',
      message: 'The name or password you entered were not valid.',
    };
    return res.redirect('/');
  }
});

function getCurrentAzureAccount(req) {
  // if there's no session, see if they passed it in on the command line
  if( !req.session.azureAccount && opts._.length===2 ) req.session.azureAccount = { name: opts[0], key: opts[1] };
  return req.session.azureAccount;
}

function getAzureBlobService(req) {
  var azureAccount = getCurrentAzureAccount(req);
  return azureAccount ? azure.createBlobService( azureAccount.name, azureAccount.key ) : null;
}

function getHomeDir() {
  return process.platform === 'win32' ?
    process.env['USERPROFILE'].replace( /\\/g, '/' ) :
    process.env['HOME'];
}

function getLocalDir( path ) {
  path = (path || '~').replace( /^~/, getHomeDir() ).replace( /([^/]|^)$/, '$1/' );
  var dir = {
    path: path,
    name: path.match( /[^/]*\/$/ )[0].replace(/[^/]$/,'/'),
    isDirectory: true,
    isHidden: false,
    size: 0,
    mtime: null, // TODO
    entries: []
  };
  if( path.match(/\//g).length > 2 ) dir.entries.push({
    name: '../',
    path: path.replace(/\/[^/]+\/$/,'/'),
    isDirectory: true,
    isHidden: false,
    size: 0,
    mtime: null
  });
  fs.readdirSync( dir.path ).forEach(function(fname){
      var entryPath = dir.path + fname;
      var stats = fs.statSync( entryPath );
      dir.entries.push( {
        name: fname + (stats.isDirectory() ? '/' : ''),
        path: entryPath + (stats.isDirectory() ? '/' : ''),
        isDirectory: stats.isDirectory(),
        isHidden: process.platform!=='win32' && fname[0]==='.',   // currently do not support Windows hidden files
        size: stats.size,
        mtime: moment(stats.mtime).format('L')
      } );
  });
  return dir;
}

app.get('/api/local/ls', function(req,res){
  // if they don't supply a working directory, assume they mean the home directory; note that we ensure directories end with a slash
  // we also take ~ as a shortcut for the user's home directory
  try {
    var dir = getLocalDir(req.query.path);
    res.json(dir);
  } catch( ex ) {
    console.error( 'Error listing local path: "' + req.query.path + '"' );
    console.error( ex );
    res.json( { error: 'Unable to list path.' } );
  }
});

// this is our in-memory cache of azure files; in the future, we'll probably want to do some
// memory management so this doesn't get unweieldy for long-running processes
var _azureCache = {};

// given a normalized path (defined below), return the various azure parts (container, name) as well
// as "pseudodata" (like virtual dir information)
// a normalized azure "path" looks like one of the following:
//          ''                                 account (missing slash forgiven)
//          '/'                                account
//          '/xyz'                             container (missing slash forgiven)
//          '/container/'                      container
//          '/container/file.txt'              file
//          '/container/dir/'                  virtual directory
//          '/container/dir/file.txt'          file (in virtual dir)
//          '/container/dir/subdir/file.txt    file (in virtual dir)
// in Azure, of course, there are no real directories, only containers and files.
// files can have slashes in them, creating "virtual" directories.  we consider
// containers and virtual directories to be directories.  for convention's sake,
// directories are considered to end with a slash.
// this will return an object with the following fields:
//     type              one of 'account', 'container', 'virtual directory', or 'file'
//     name              name of container, virtual directory, or file (ex: 'container', 'file.txt', 'dir')
//     azureName         full name of file in container (ex: 'file.txt', 'dir/file.txt', 'dir/subdir/file.txt')
//     dir               virtual directory (ex: 'dir', 'dir/subdir')
//     dirParts          virtual directory parts (ex: [], ['dir'], ['dir','subdir'])
function getAzureParts( path ) {
  path = (path || '').trim();
  var pathParts = path.replace(/^\/|\/$/g,'').split('/');

  var azureParts = { type: 'account', dir: '', dirParts: [] };
  if( pathParts.length===1 && pathParts[0]==='' ) return azureParts;   // all done!

  azureParts.container = pathParts[0];
  azureParts.name = pathParts[pathParts.length-1];
  if( pathParts.length===1 ) {
    azureParts.type = 'container';
    return azureParts;
  }

  if( path.match(/\/$/) ) {
    azureParts.type = 'virtual directory';
    azureParts.dirParts = pathParts.slice(1);
  } else {
    azureParts.type = 'file';
    azureParts.name = pathParts[pathParts.length-1];
    azureParts.azureName = pathParts.slice(1).join('/');
    azureParts.dirParts = pathParts.slice(1,pathParts.length-1); // will result in empty array if no virtual directory
  }
  azureParts.dir = azureParts.dirParts.join('/'); // will be an empty string if there is no virtual directory

  return azureParts;
}

function refreshAzureCache( account, containerName, done ) {
  var blobService = azure.createBlobService( account.name, account.key );
  if( !_azureCache[account.name] ) {
    _azureCache[account.name] = {};
    blobService.listContainers(function(err,containers){
      containers.forEach(function(container){
        _azureCache[account.name][container.name] = {};
      });
      if( !containerName ) done();
    });
  }
  if( !containerName ) return;
  // we simply re-construct the container object; when we're done, we'll put it in the cache
  var container = { files: [], dir: {} };
  blobService.listBlobs(containerName,function(err,blobs){
    // TODO: error handling
    blobs.forEach(function(blob){
      container.files.push( blob );
    });
    // note that we don't construct the dir; that's done on a JIT basis in getAzureVirtualDirectoryEntries
    _azureCache[account.name] = _azureCache[account.name] || {};
    _azureCache[account.name][containerName] = container;
    done();
  });
}

function getAzureVirtualDirectoryEntries( account, azureParts ) {
  var dir;
  if( azureParts.type === 'account' ) {
    // all we have to do is list the continers
    dir = {
      name: '/',
      path: '/',
      isDirectory: true,
      isHidden: false,
      size: 0,
      mtime: null,
      entries: []
    };
    for( var container in _azureCache[account.name] ) {
      dir.entries.push({
        name: container,
        path: '/' + container + '/',
        isDirectory: true,
        isHidden: false,
        size: 0,
        mtime: null
      });
    }
    return dir;
  }
  var files = _azureCache[account.name][azureParts.container].files;
  var subdirsProcessed = {};
  var entries = [{
    name: '../',
    path: ('/' + azureParts.container + '/' + azureParts.dir).replace(/\/[^/]+\/$/,'/'),
    isDirectory: true,
    isHidden: false,
    size: null,
    mtime: null,
    keepMe: true,
  }];
  dir = azureParts.dir;
  if( dir !== '' ) dir = dir + '/';
  files.forEach(function(azureBlob){
    if( azureBlob.name.indexOf( dir )!==0 ) return;
    var remainder = azureBlob.name.substr( dir.length );
    var slashIdx = remainder.indexOf('/');
    if( slashIdx>=0 ) {
      // subdirectory
      var subdir = remainder.substr(0,slashIdx);
      if( subdirsProcessed[subdir] ) return;
      entries.push({
        name: subdir,
        path: '/' + azureParts.container + '/' + dir + subdir + '/',
        isDirectory: true,
        isHidden: false,
        show: true,
        size: 0,
        mtime: azureBlob.properties['last-modified'],  // TODO
      });
      subdirsProcessed[subdir] = true;
    } else {
      // file
      var path = '/' + azureParts.container + '/' + dir + remainder;
      entries.push({
        name: remainder,
        path: path,
        url: 'http://' + account.name + '.blob.core.windows.net' + path,
        isDirectory: false,
        isHidden: false,
        size: azureBlob.properties['content-length'],   // TODO
        mtime: azureBlob.properties['last-modified'],  // TODO
        isRemote: true,
      });
    }
  });
  var path = ('/' + azureParts.container + '/' + azureParts.dirParts.join('/')).replace(/([^/])$/,'$1/');
  return {
      name: path.match(/([^/]+)\/$/)[0],
      path: path,
      isDirectory: true,
      isHidden: false,
      size: 0,
      mtime: null,
      entries: entries
    };
}

function getAzureDirFromCache( account, path, fn ) {
  var azureParts = getAzureParts( path );
  // for now, we're just calling getAzureVirtualDirectoryEntries method; in the future, we will
  // build up the cache
  fn( getAzureVirtualDirectoryEntries( account, azureParts ) );
}

function azureCacheNeedsRefresh( account, azureParts ) {
  if( !_azureCache[account.name] ) return true;
  if( azureParts.type==='account' ) return false;
  return !_azureCache[account.name][azureParts.container] || !_azureCache[account.name][azureParts.container].files;
}

function getAzureDir( account, path, fn, forceRefresh ) {
  var azureParts = getAzureParts( path );
  if( forceRefresh || azureCacheNeedsRefresh( account, azureParts ) )
    refreshAzureCache( account, azureParts.container, function(){ getAzureDirFromCache( account, path, fn ); } );
  else
    getAzureDirFromCache( account, path, fn );
}

function prettySize(size){
  if(size < 1000) return size.toFixed(0) + ' B';
  if(size < 1000000) return (size/1024).toFixed(2) + ' kB';
  if(size < 1000000000) return (size/1048576).toFixed(2) + ' MB';
  if(size < 1000000000000) return (size/1073741824).toFixed(2) + ' GB';
  return (size/1000000000000).toFixed(2) + ' TB';
}

app.get('/api/azure/upload', function(req,res){
  var account = getCurrentAzureAccount(req);
  var src = req.query.src;
  var dst = req.query.dst;
  var blobService = azure.createBlobService( account.name, account.key );
  var azureParts = getAzureParts( dst );
  blobService.createBlockBlobFromFile( azureParts.container, azureParts.azureName, src, function(err,blob) {
    var cache = _azureCache[account.name][azureParts.container].files;
    if( err ) {
      console.error( "Unable to upload %s to %s.", src, dst );
      return res.json( { error: 'Server error uploading file.' } );
    } else {
      // TODO: uuuuuugly
      if( _azureCache[account.name] &&
        _azureCache[account.name][azureParts.container] && cache && cache.indexOf( blob.blob ) < 0 ) {
          blobService.listBlobs(azureParts.container, function(err,blobs){
          var fileName = dst.replace("/" + azureParts.container + "/", "");
          var newblob = blobs.filter(function(blob){ return blob.name == fileName; })[0];
            if(newblob === undefined) {
              return res.json( {error: "Something went wrong."});
            }
            for(var i = 0; i < cache.length; i++) {
              if(cache[i].name == fileName) {
                cache[i] = newblob;
              }
            }
            cache.push(newblob);
            return res.json( { message: 'File uploaded successfully.' } );
          });
      } else {
        return res.json( { error: 'Unable to upload file.' });
      }
    }
  });
});

// Array.prototype.remove found here: http://stackoverflow.com/questions/500606/javascript-array-delete-elements
// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

app.get('/api/azure/delete', function(req,res) {
  var account = getCurrentAzureAccount(req);
  var blobService = azure.createBlobService( account.name, account.key );
  var azureParts = getAzureParts( req.query.path );
  if( azureParts.type === 'file' ) {

    blobService.deleteBlob( azureParts.container, azureParts.azureName, function( error, isSuccessful ) {
      if( !isSuccessful ) {
        res.json( { error: error } );
      } else {
        if( _azureCache[account.name] && _azureCache[account.name][azureParts.container] && _azureCache[account.name][azureParts.container].files ) {
          var idx;
          for(var i = 0; i < _azureCache[account.name][azureParts.container].files.length; i++) {
            if (_azureCache[account.name][azureParts.container].files[i].name === azureParts.azureName) {
              idx = i;
              break;
            }
          }
          idx>=0 && _azureCache[account.name][azureParts.container].files.remove( idx );
        }
        res.json( { message: 'File deleted successfully.' } );
      }
    });
  } else {
    var msg = 'Unable to delete blob ' + req.query.path;
    console.warn( msg );
    res.json( { error: msg } );
  }
});

app.get('/account/:name', function(req,res) {
  res.render('account');
});

app.get('/partials/local/dir', function(req,res){
  var path = req.query.path;
  var dir = getLocalDir(path);
  dir.layout = false;
  dir.entries.forEach(function(f){
    f.prettySize = prettySize(f.size);
    f.prettyDate = moment(new Date(f.mtime)).format('L');
  });
  res.render('_partials/dir_listing', dir);
});

app.get('/partials/azure/dir', function(req,res){
  var path = req.query.path;
  getAzureDir( getCurrentAzureAccount(req), path, function(dir) {
    dir.layout = false;
    dir.entries.forEach(function(f){
      f.prettySize = prettySize(parseInt(f.size));
      f.prettyDate = moment(new Date(f.mtime)).format('L');
    });
    res.render('_partials/dir_listing', dir);
  });
});

var opts = require('nomnom')
  .option( 'port', { abbr: 'p', flag: false, 'default': 3000 } )
  .parse();

app.listen( opts.port );
console.log( 'Listening on port ' + opts.port + '....');


