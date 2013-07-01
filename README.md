cx
===========

Cloud transfer utility: for transferring files to and from the cloud.

Currently Supported Cloud Storage Providers
-------------------------------------------
Currently, cx only supports [Microsoft Azure](http://www.windowsazure.com/en-us/), though
support for [Amazon S3](http://aws.amazon.com/s3/) is planned next, with other to follow.
In addition to cloud storage, we intend to also provide support for plain FTP and SFTP at
some point.

Browser-based Client
--------------------
Currently, the only cx UI available is a browser-based interface, courtesy [Express](http://aws.amazon.com/s3/).
In the future, a command-line client, as well as a JavaScript module is planned.

Usage
-----
To use cx, simply install it by typing `sudo npm install -g cx` on the terminal (you may need to
[install Node](http://nodejs.org/) first).  You will be prompted for your administrator password.
You may see some warnings in red as you install, and you may safely ignore those: only errors will
prevent cx from working.  To use the browser-based client, first start the
cx server by simply typing `cxs` on terminal (do not close this terminal window).  By default,
the the cx server starts on port 3000, so all you have to do is point a web browser to
[localhost:3000](http://localhost:3000).  If you wish to run on a port other than 3000, you
may specify the port number thusly: `cxs -p 1234`.  Lastly, you may provide your Microsoft Azure
storage account name and key on the command line: `cxs [-p 1234] account key`.

Using cx
--------
The UI is currently very bare-bones.  Be patient: we're working hard on fleshing it out!  To navigate
directories, simply click on them.  To transfer files from local storage to your Azure account, simply
drag the filename over to the Azure storage area.  Note that you may drag into either the current
Azure storage container or virtual directory, or a subdirectory.  If you drag into a subdirectory, the
subdirectory will be highlighted, indicating the file is going to go in that directory.  When clicking
on a container with many files, be patient: it may take a while, and there is currently no "please wait"
feedback to let you know anything is happening.

Some Technical Mumbo Jumbo
--------------------------
An Azure storage account has no inherent concept of "directories"; only containers and blobs.  Cx attempts
to create a "normalized" view of Azure storage with the concept of "virtual directories".  This can be
accomplished because the backslash character is a valid character in blob names.  Because of the nature of
Azure storage, this imposes a couple of limitations on cx.  First, you can't upload files into the
"root directory" (all blobs must be in a container).  Secondly, you can't create empty virtual directories
(for a virtual directory to exist, there must be at least one file in it).  There's nothing to be done about
the first problem.  For the second problem, cx will remember any new virtual directories as long as it is
running, which simulates creating directories.  Once you upload files to those virtual directories, they
become permanent.

Implementation Notes
--------------------
Lord, please don't judge me on the code in its current state!  It's an ugly, non-modularized mess that's not
the least bit DRY.  I had to get this working for a client, so it was put together in something of a rush.
Expect a major re-write soon that will completely re-structure the source code to be more logical, easy-to-read,
extensible, testable, and modular.

Features Coming Soon
--------------------
* Directory sorting (alpha by name, or date, directories first).
* Hidden files hidden by default.
* Display file size and modification date.
* Better feedback for time-consuming acitons (like listing a large container).
* Better feedback for file transfer success.
* Scrollable directory views (currently you have to scroll the whole browser).
* Ability to create virtual directories and containers.
* File overwrite confirmation.

Features Down the Road
----------------------
* Directory filtering.
* Bulk file transfer (whole directories/groups of files).
* Progress display for bulk file transfer.
* Modifying file metadata.
* "Flat" blob view (eschewing virtual directories).

Features Way Down the Road
--------------------------
* Savable transfer "sessions" that support pause/resume/reporting.
