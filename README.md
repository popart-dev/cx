cx
==

Cloud transfer utility: for transferring files to and from the cloud.

Currently Supported Cloud Storage Providers
-------------------------------------------
Currently, cx only supports [Microsoft Azure](http://www.windowsazure.com/en-us/), though
support for [Amazon S3](http://aws.amazon.com/s3/) is planned next, with other to follow.
In addition to cloud storage, we intend to also provide support for plain FTP and SFTP at
some point.

Browser-based Client
--------------------
Currently, the only CX ui available is a browser-based interface, courtesy [Express](http://aws.amazon.com/s3/).
In the future, a command-line client, as well as a JavaScript library is planned.

Usage
-----
To use cx, simply install it by typing `npm install -g cx` on the terminal (you may need to 
[install Node](http://nodejs.org/) first).  To use the browser-based client, first start the 
cx server by simply typing `cxs` on terminal (do not close this terminal window).  By default,
the the cx server starts on port 3000, so all you have to do is point a web browser to 
[localhost:3000](http://localhost:3000).  If you wish to run on a port other than 3000, you
may specify the port number thusly: `cxs -p 1234`.  Lastly, you may provide your Microsoft Azure
storage account name and key on the command line: `cxs [-p 1234] account key`.
