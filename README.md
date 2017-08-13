# Webcut 

Webcut provides a websocket server side implementation of OpenCV Grabcut
and a simple client web application.
To try just place the files in any web server and run the Python script inside
`server` folder.

## Server
The `server` folder contains a Python script implementing a simple websocket
server that handles image segmentation using Grabcut.
It requires:
* Python 3.5.3
* Python OpenCV 3.2.0
* Scipy 0.18.1
* Autobahn 0.15.0

All those modules are available in [pypi](https://pypi.python.org/pypi) and
can be installed via `pip`.

## Client Application
All other files compose a client web application that uses the server.
It requires:
* [jQuery 3.2.1](http://jquery.com/)
* fabricjs 1.7.17 (http://fabricjs.com/)
* [Font Awesome 4] (http://fontawesome.io/)
* [JavaScript Load Image](https://github.com/blueimp/JavaScript-Load-Image)
