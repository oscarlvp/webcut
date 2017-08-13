import cv2, json, base64, numpy as np

from io import BytesIO
from scipy.misc import imread, imsave
from autobahn.twisted.websocket import WebSocketServerProtocol, WebSocketServerFactory


class SegmentServerProtocol(WebSocketServerProtocol):
    DATA_URL_HEADING = b'data:image/png;base64,'

    def onConnect(self, request):
        print("Client connecting : {0}".format(request.peer))

    def onOpen(self):
        print("WebSocket connection open.")
   
    
    def onMessage(self, payload, isBinary):

        data = json.loads(payload.decode('utf8'))

        if 'image' in data:
            frame = self.imageFromDataURL(data['image'])
            self.image = frame[:,:,:-1] #Removing the alpha channel

        if 'selection' in data:
            selection = data['selection']
            rect = self.getRect(selection)
            self.initializeSegmentation(rect)
            self.sendResult()

        if 'action' in data:
            image = self.imageFromDataURL(data['path'])
            path = image[:,:,-1]
            path[path != 0] = 255
            copy_mask = np.zeros_like(self.mask)
            x, y = self.getOffset(data)
            height, width = path.shape
            copy_mask[y:y+height, x:x+width] = path
            value = cv2.GC_FGD if data['action'] == 'add' else cv2.GC_PR_BGD
            self.mask[copy_mask != 0] = value
            self.updateSegmentation()
            self.sendResult()

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))

    def getRect(self, data):
        return self.tupleFromData(data, ['left', 'top', 'width', 'height'])
    
    def getOffset(self, data):
        return self.tupleFromData(data, ['left', 'top'])

    def tupleFromData(self, data, keys):
        return tuple([int(data[key]) for key in keys])

    def imageFromDataURL(self, dataURL):
        encoded_image = BytesIO(bytes(dataURL[len(self.DATA_URL_HEADING):], 'utf8'))
        decoded_image = BytesIO()
        base64.decode(encoded_image, decoded_image)
        decoded_image.seek(0)
        return imread(decoded_image)

    def imageToDataURL(self, image):
        image_file = BytesIO()
        imsave(image_file, image, 'png')
        image_file.seek(0)
        return self.DATA_URL_HEADING + base64.encodebytes(image_file.read())

    def initializeSegmentation(self, rect):
        ##TODO: Refine the result until no significant change is obtained???
        ##TODO: Keep the models???
        self.mask, bg, fg = cv2.grabCut(self.image, None, rect, None, None, 1, cv2.GC_INIT_WITH_RECT)
        return self.mask

    def updateSegmentation(self):
        ##TODO: Idem as the other segmentation method
        self.mask, bg, fg = cv2.grabCut(self.image, self.mask, None, None, None, 1, cv2.GC_INIT_WITH_MASK)
        return self.mask

    def getResult(self):
        ##TODO: Some postprocessing
        ##Taken from grabcut OpenCV example
        return np.where((self.mask==1) + (self.mask==3),255,0).astype('uint8')
    
    def sendResult(self):
        self.sendMessage(self.imageToDataURL(self.getResult()))


if __name__ == '__main__':

    import sys

    from twisted.python import log
    from twisted.internet import reactor

    log.startLogging(sys.stdout)

    factory = WebSocketServerFactory(u"ws://127.0.0.1:9000")
    factory.protocol = SegmentServerProtocol

    # note to self: if using putChild, the child must be bytes...

    reactor.listenTCP(9000, factory)
    reactor.run()
