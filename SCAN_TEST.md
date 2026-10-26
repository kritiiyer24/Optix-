# Scan test guide

Use this to test Optix eye scan on a phone. A good test result means the app took the flash, accepted or rejected the photo for the right reason, and updated Home. It does not mean someone’s vision is healthy or unhealthy.

The five scores are light patterns from the flash. They are not a glasses prescription.

## Before you start

1. Install Expo Go and open the same Optix project your lead is running (`npx expo start --lan`, same Wi-Fi).
2. Finish the intro.
3. Enroll the **parent** face: 3 stills, the child’s first name, and a 4-digit PIN. The eye scan never uses the child’s face as the lock.
4. Unlock with that parent face or the PIN.
5. Wait until the scan button is tappable. If it stays disabled, the eye model is still loading. The debug panel at the top of the phone shows the reason.

You need a dark room, a person who can look at the phone, and the rear camera. The flash stays off until the checks pass.

## How to take a scan

1. Open the **Scan** tab. Home’s **Start a scan** button goes there too.
2. The parent holds the phone. The other person looks at the phone.
3. Tap **Start the scan**. Leave the screen up.
4. **Dark room.** Turn the lights off. The hint stays on this step until the room is dark.
5. **1 meter.** Put both eyes in the oval. Move until the hint says **1 meter. Hold still.** Closer than that says move back. Farther says move closer.
6. **Look.** The phone says “Look directly at the camera lens.” The person looks at the lens.
7. **Flash.** The flash fires once. Wait for **Reading the flash…** to finish. Do not leave the screen.

Stop ends the scan and does not save. The flash does not fire until the room is dark and the phone has held 1 meter.

The photo is measured once and then thrown away. Only the time and five scores are kept. The phone keeps up to 24 scans.

## What a good scan looks like

All of these should happen:

- The hint under the oval says: **Photo accepted. Both eyes were in the flash. This is not a prescription.**
- The note changes from **Nothing saved yet** to **1 saved on this phone** (then 2, 3, and so on).
- A time appears under that note.
- On **Home**, the line under the child’s name counts the flash photos.
- All five rows leave **Waiting**:
  - Near vision
  - Far vision
  - Astigmatism
  - Left vs right
  - Alignment

Each row becomes **Steady** or **Watch**.

| Label | Meaning in this test |
| --- | --- |
| Waiting | No saved scan yet. |
| Steady | A scan was saved, and that reading is not in the watch range. |
| Watch | That reading is high on the latest scan (0.45 or more), or it jumped by 0.12 or more since the previous scan and is already at least 0.28. |

Home does not show the raw 0–1 numbers. You check the label, the saved count, and the time.

Tips do not change after a scan. Those two cards stay the same. That is expected.

## What a failed scan looks like

Nothing new is saved. The saved count does not go up. Home stays as it was.

| What you did | Message you should see |
| --- | --- |
| Lights still on | Room is still bright. Turn the lights off. The flash does not fire. |
| Phone not at 1 meter | A distance such as **0.72 m. Move back.** or **1.24 m. Move closer.** The flash does not fire. |
| Room so dark the face is lost | Both eyes need to stay in the oval. The face should still be visible. |
| Flash photo too dark to read | Too dark. The face should still be visible in the oval. |
| Phone too close, or flash blows out the eyes | That flash washed the eyes out. Hold the phone a little farther away. |
| Eyes outside the oval, or one eye closed / blocked | The flash did not catch both eyes. Keep them in the oval and try again. |
| No face in the photo | No face in that flash. Both eyes in the oval, then try again. |
| Model never answers | The on-device model did not answer (20s). |

If the hint says **Reading the flash…** for a long time and then shows an error, open the debug panel and write down the red line.

## Test script

Do these in order. Write Pass or Fail and a one-line note.

| # | Test | Pass when |
| --- | --- | --- |
| 1 | Dark room, both eyes in the oval, follow the hints through 1 meter and the spoken cue | Saved message, count increases, Home leaves Waiting |
| 2 | Cover the lens or point at a wall | Hint asks for both eyes, or an error appears. Count does not increase. Tap Stop. |
| 3 | Eyes outside the oval | Flash-miss or no-face message, count does not increase |
| 4 | Hold the phone very close | Distance hint says move back, count does not increase |
| 5 | Repeat test 1 right away, same person, same distance | Another save, count increases by one, Home still shows Steady or Watch on all five rows |
| 6 | Lock the app, unlock, open Home | The earlier scan count is still there |

Two good scans of the same person will not always produce the same Steady / Watch labels. Distance, where the eyes sit in the oval, and the flash all move the numbers. Test 5 passes if the second photo saves. It does not have to match the first labels exactly.

## Notes to bring back

- Phone model and whether you used Expo Go
- Room: dim, or brighter than the guide
- Approximate distance from the face
- For each test: Pass or Fail, the exact message, and the five Home labels
- Any red line from the debug panel
