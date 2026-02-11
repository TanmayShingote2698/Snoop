import face_recognition
import cv2
import os


class FaceRecognition:

    def __init__(
        self,
        no_person_limit=50,
        more_person_limit=30,
        not_matching_limit=50,
        tolerance=0.6
    ):
        self.integrity = {
            "no_person": {"frames": 0, "warnings": 0, "buffer": 0, "limit": no_person_limit},
            "more_person": {"frames": 0, "warnings": 0, "buffer": 0, "limit": more_person_limit},
            "no_match": {"frames": 0, "warnings": 0, "buffer": 0, "limit": not_matching_limit},
            "total_frames": 0,
            "fair_frames": 0
        }

        self.tolerance = tolerance
        self.user_encoding = None
        self.user_id = None

    def load_student(self, user_image_path, user_id):
        self.user_id = user_id
        if not os.path.exists(user_image_path):
            raise FileNotFoundError(f"User image not found: {user_image_path}")

        user_image = face_recognition.load_image_file(user_image_path)
        encodings = face_recognition.face_encodings(user_image)

        if not encodings:
            raise RuntimeError("No face found in reference image")

        self.user_encoding = encodings[0]
        print(f"Loaded student profile: {user_id}")

    # ---------------- Helpers ---------------- #

    def raise_warning(self, np=False, mp=False, nm=False):
        if np:
            self.integrity["no_person"]["warnings"] += 1
        elif mp:
            self.integrity["more_person"]["warnings"] += 1
        elif nm:
            self.integrity["no_match"]["warnings"] += 1

    def raise_frame(self, np=False, mp=False, nm=False):
        if np:
            self.integrity["no_person"]["frames"] += 1
            self.integrity["no_person"]["buffer"] += 1
            self.integrity["more_person"]["buffer"] = 0
            self.integrity["no_match"]["buffer"] = 0
        elif mp:
            self.integrity["more_person"]["frames"] += 1
            self.integrity["more_person"]["buffer"] += 1
            self.integrity["no_person"]["buffer"] = 0
            self.integrity["no_match"]["buffer"] = 0
        elif nm:
            self.integrity["no_match"]["frames"] += 1
            self.integrity["no_match"]["buffer"] += 1
            self.integrity["no_person"]["buffer"] = 0
            self.integrity["more_person"]["buffer"] = 0

    def reset_buffer(self):
        for k in ("no_person", "more_person", "no_match"):
            self.integrity[k]["buffer"] = 0

    # ---------------- Core loop ---------------- #

    def run(self, frame, result):
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        self.integrity["total_frames"] += 1

        face_locations = face_recognition.face_locations(rgb_small, model="hog")
        count = len(face_locations)

        if count == 0:
            self.raise_frame(np=True)

        elif count > 1:
            self.raise_frame(mp=True)

        else:
            face_encodings = face_recognition.face_encodings(
                rgb_small,
                face_locations,
                num_jitters=0   # FAST & STABLE
            )

            if not face_encodings:
                self.raise_frame(np=True)
            else:
                dist = face_recognition.face_distance(
                    [self.user_encoding],
                    face_encodings[0]
                )[0]

                if dist < self.tolerance:
                    self.reset_buffer()
                    self.integrity["fair_frames"] += 1
                else:
                    self.raise_frame(nm=True)

        # -------- Warnings overlay -------- #
        if self.integrity["no_person"]["buffer"] >= self.integrity["no_person"]["limit"]:
            if self.integrity["no_person"]["buffer"] % self.integrity["no_person"]["limit"] == 0:
                self.raise_warning(np=True)
            cv2.putText(frame, "No person detected!", (150, 200),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        elif self.integrity["more_person"]["buffer"] >= self.integrity["more_person"]["limit"]:
            if self.integrity["more_person"]["buffer"] % self.integrity["more_person"]["limit"] == 0:
                self.raise_warning(mp=True)
            cv2.putText(frame, "Multiple people detected!", (100, 200),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        elif self.integrity["no_match"]["buffer"] >= self.integrity["no_match"]["limit"]:
            if self.integrity["no_match"]["buffer"] % self.integrity["no_match"]["limit"] == 0:
                self.raise_warning(nm=True)
            cv2.putText(frame, "Unauthorized person!", (120, 200),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        # -------- Draw boxes -------- #
        for top, right, bottom, left in face_locations:
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4
            cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)

        result.write(frame)

    def get_integrity(self):
        return self.integrity