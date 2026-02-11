import os
import cv2
import dlib
import numpy as np
from datetime import datetime

# helper modules
from utils.drawFace import draw
import utils.reference_world as world


class LandmarkDetection:

    def __init__(self):
        # -------- Resolve absolute path safely -------- #
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))

        self.PREDICTOR_PATH = os.path.join(
            BASE_DIR,
            "weights",
            "shape_predictor_68_face_landmarks.dat"
        )

        if not os.path.exists(self.PREDICTOR_PATH):
            raise FileNotFoundError(
                f"Landmark model not found: {self.PREDICTOR_PATH}"
            )

        self.detector = dlib.get_frontal_face_detector()
        self.predictor = dlib.shape_predictor(self.PREDICTOR_PATH)

        self.left = False
        self.GAZE = "Face Not Found"
        self.integrity = {
            "face-toggle": []
        }

    def run(self, img, result):
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = self.detector(rgb, 0)
        face3Dmodel = world.ref3DModel()

        for face in faces:
            shape = self.predictor(rgb, face)
            draw(img, shape)

            refImgPts = world.ref2dImagePoints(shape)
            height, width, _ = img.shape

            focalLength = 5 * width
            cameraMatrix = world.cameraMatrix(
                focalLength,
                (width / 2, height / 2)
            )

            mdists = np.zeros((4, 1), dtype=np.float64)

            success, rotationVector, translationVector = cv2.solvePnP(
                face3Dmodel, refImgPts, cameraMatrix, mdists
            )

            noseEndPoints3D = np.array([[0, 0, 1000.0]], dtype=np.float64)
            noseEndPoint2D, _ = cv2.projectPoints(
                noseEndPoints3D,
                rotationVector,
                translationVector,
                cameraMatrix,
                mdists
            )

            p1 = (int(refImgPts[0, 0]), int(refImgPts[0, 1]))
            p2 = (int(noseEndPoint2D[0, 0, 0]), int(noseEndPoint2D[0, 0, 1]))
            cv2.line(img, p1, p2, (110, 220, 0), 2, cv2.LINE_AA)

            rmat, _ = cv2.Rodrigues(rotationVector)
            angles, *_ = cv2.RQDecomp3x3(rmat)

            if angles[1] < -15:
                if not self.left:
                    self.integrity["face-toggle"].append(datetime.now())
                    self.left = True
                self.GAZE = "Looking: Left"

            elif angles[1] > 15:
                if self.left:
                    self.integrity["face-toggle"].append(datetime.now())
                    self.left = False
                self.GAZE = "Looking: Right"

            else:
                self.GAZE = "Forward"

        cv2.putText(
            img,
            self.GAZE,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 80),
            2
        )

        result.write(img)

    def get_integrity(self):
        return self.integrity