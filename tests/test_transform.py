import unittest

from traffic_etl.transform import congestion_level, los_from_velocity


class TransformTests(unittest.TestCase):
    def test_los_thresholds(self):
        self.assertEqual(los_from_velocity(6.9), "F")
        self.assertEqual(los_from_velocity(12.9), "E")
        self.assertEqual(los_from_velocity(19.9), "D")
        self.assertEqual(los_from_velocity(29.9), "C")
        self.assertEqual(los_from_velocity(34.9), "B")
        self.assertEqual(los_from_velocity(35), "A")

    def test_congestion_level(self):
        self.assertEqual(congestion_level(0.1), "thoang")
        self.assertEqual(congestion_level(0.3), "trung_binh")
        self.assertEqual(congestion_level(0.5), "dong")
        self.assertEqual(congestion_level(0.8), "un_tac")
        self.assertEqual(congestion_level(0.1, road_closed=True), "closed")
        self.assertEqual(congestion_level(0.1, velocity_kmph=28), "trung_binh")
        self.assertEqual(congestion_level(0.1, velocity_kmph=18), "dong")


if __name__ == "__main__":
    unittest.main()
