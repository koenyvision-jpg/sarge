// How-to content for the exercise info sheet.
// photo: folder name in public/ex/ (from free-exercise-db, public domain), shown as <name>-0.jpg / -1.jpg.
// similar: the photo shows a close variation (other equipment or stance), not the exact exercise.
// figure: no suitable photo, a drawn pose from exerciseFigures.jsx is shown instead.

const I = (photo, how, cues, extra = {}) => ({ photo, how, cues, ...extra })
const S = (photo, how, cues) => I(photo, how, cues, { similar: true })
const F = (how, cues) => ({ figure: true, how, cues })

export const EXERCISE_INFO = {
  // Squat
  'back-squat': I('Barbell_Full_Squat', [
    'Bar on your upper back (not your neck), hands just outside shoulders, feet shoulder-width, toes slightly out.',
    'Big breath into your belly, brace, and sit down between your heels — knees track over your toes.',
    'Go to at least thighs parallel, then drive up through the whole foot, chest and hips rising together.',
  ], ['Keep your heels down and your knees pushed out.', 'Don\'t let your hips shoot up first — that turns it into a good morning.']),
  'front-squat': I('Front_Barbell_Squat', [
    'Bar rests on the front of your shoulders, elbows high, fingertips under the bar (or arms crossed).',
    'Brace and squat straight down, keeping your torso upright.',
    'Stand up by driving your elbows up and your feet into the floor.',
  ], ['Elbows up the whole time or the bar rolls forward.', 'More upright and more quads than a back squat.']),
  'goblet-squat': I('Goblet_Squat', [
    'Hold one dumbbell vertically against your chest, hands cupping the top end.',
    'Feet a bit wider than shoulders. Sit down between your heels, elbows brushing the inside of your knees.',
    'Pause at the bottom, then stand up tall.',
  ], ['Chest up, weight stays glued to your chest.', 'Great for learning depth — go as deep as you can with a flat back.']),
  'kb-goblet-squat': S('Goblet_Squat', [
    'Hold the kettlebell by the horns (handle sides), bell against your chest.',
    'Feet a bit wider than shoulders. Sit down between your heels, elbows inside your knees.',
    'Pause at the bottom, then stand up tall.',
  ], ['Chest up, bell stays tight to your body.', 'Push your knees out with your elbows at the bottom to open the hips.']),
  'kb-front-squat': I('Front_Squats_With_Two_Kettlebells', [
    'Clean the kettlebell(s) to the rack position: handle in your palm, bell resting on the outside of your forearm, elbows tucked.',
    'Brace and squat down between your heels, torso upright.',
    'Drive up through the whole foot without letting the bells pull you forward.',
  ], ['Wrists straight, elbows in against your ribs.', 'One bell? Hold it racked on one side and switch sides each set — your core works hard to stay square.']),
  'leg-press': I('Leg_Press', [
    'Sit with your back and hips flat on the pad, feet shoulder-width in the middle of the platform.',
    'Release the safeties and lower the platform until your knees are around 90° or a bit deeper.',
    'Press back up without locking your knees hard at the top.',
  ], ['Your lower back must stay on the pad — stop the descent before it rounds.', 'Push through your heels and mid-foot.']),
  'band-squat': I('Squats_-_With_Bands', [
    'Stand on the band with feet shoulder-width; loop the other end over your shoulders or hold it at shoulder height.',
    'Squat down between your heels.',
    'Stand up hard — the band gets heavier at the top, so finish the rep.',
  ], ['Keep tension on the band the whole time.', 'Knees out, heels down.']),
  'air-squat': I('Bodyweight_Squat', [
    'Feet shoulder-width, toes slightly out, arms forward for balance.',
    'Sit down and back between your heels as deep as you can with a flat back.',
    'Stand up and squeeze your glutes at the top.',
  ], ['Heels stay down.', 'Control the way down — 2 seconds.']),
  'jump-squat': I('Freehand_Jump_Squat', [
    'Stand feet shoulder-width. Drop into a quarter to half squat, arms swinging back.',
    'Explode up, swinging your arms, and leave the ground.',
    'Land softly on the balls of your feet, sink straight into the next rep.',
  ], ['Quiet landings — soft knees.', 'Quality over quantity: stop when height drops.']),

  // Hinge
  'deadlift': I('Barbell_Deadlift', [
    'Bar over mid-foot, feet hip-width. Hinge down and grip just outside your legs.',
    'Shins to the bar, chest up, flat back. Pull the slack out of the bar and brace.',
    'Push the floor away, bar dragging up your legs, until you stand tall. Lower the same way.',
  ], ['Bar stays in contact with your legs.', 'Never round your lower back to get the bar off the floor.']),
  'rdl': I('Romanian_Deadlift', [
    'Stand tall holding the bar at your hips, knees soft.',
    'Push your hips straight back, bar sliding down your thighs, back flat, until you feel a strong hamstring stretch (usually just below the knee).',
    'Drive your hips forward to stand up.',
  ], ['It\'s a hip hinge, not a squat — knees barely bend.', 'Bar stays close; stop where your back would start to round.']),
  'db-rdl': I('Stiff-Legged_Dumbbell_Deadlift', [
    'Stand tall with a dumbbell in each hand in front of your thighs, knees soft.',
    'Push your hips back, dumbbells sliding down your legs, back flat, until you feel the hamstrings stretch.',
    'Drive your hips forward to stand up.',
  ], ['Hips go back, not down.', 'Keep the dumbbells close to your legs.']),
  'kb-rdl': S('Stiff-Legged_Dumbbell_Deadlift', [
    'Stand tall holding the kettlebell by the handle with both hands in front of your hips, knees soft.',
    'Push your hips back, bell travelling down close to your legs, back flat, until the hamstrings stretch.',
    'Squeeze your glutes and drive your hips forward to stand up.',
  ], ['Hips go back, not down — shins stay nearly vertical.', 'Shoulders pulled back; don\'t let the bell drag you forward.']),
  'kb-swing': S('One-Arm_Kettlebell_Swings', [
    'Bell a step in front of you. Hinge, grab the handle with both hands, and hike it back between your legs.',
    'Snap your hips forward hard — the hips throw the bell, your arms just guide it to chest height.',
    'Let it fall back between your legs, hinging at the hips, and repeat.',
  ], ['It\'s a hinge, not a squat, and not a front raise.', 'Stand tall and squeeze your glutes at the top. Photo shows the one-arm version.']),
  'hip-thrust': I('Barbell_Hip_Thrust', [
    'Sit with your upper back against a bench, barbell (padded) over your hips, feet flat, knees bent.',
    'Drive through your heels and lift your hips until your body is flat from knees to shoulders.',
    'Pause and squeeze your glutes, then lower under control.',
  ], ['Chin tucked, ribs down — don\'t arch your lower back to finish.', 'Shins vertical at the top.']),
  'band-good-morning': I('Band_Good_Morning', [
    'Stand on the band, loop the other end behind your neck/upper back.',
    'Soft knees, push your hips back and lower your chest with a flat back.',
    'Drive your hips forward to stand up against the band.',
  ], ['Flat back throughout.', 'Feel it in the hamstrings, not the lower back.']),
  'sl-rdl-bw': S('Kettlebell_One-Legged_Deadlift', [
    'Stand on one leg, slight bend in the knee.',
    'Hinge forward, your free leg extending straight behind you, until your body is roughly parallel to the floor.',
    'Return to standing by driving your hip forward.',
  ], ['Keep your hips square — don\'t let the free hip open up.', 'Slow and controlled; touch a wall for balance if needed. Photo shows it with a kettlebell.']),
  'glute-bridge': I('Butt_Lift_Bridge', [
    'Lie on your back, knees bent, feet flat and close to your glutes, arms by your sides.',
    'Drive through your heels and lift your hips until your body is straight from knees to shoulders.',
    'Squeeze your glutes for a second, then lower.',
  ], ['Ribs down — lift with your glutes, not by arching your back.', 'Push through your heels.']),

  // Lunge
  'bulgarian-split-squat': I('Split_Squat_with_Dumbbells', [
    'Stand a long stride in front of a bench, rest the top of your back foot on it. Dumbbells at your sides.',
    'Lower straight down until your back knee nearly touches the floor.',
    'Drive up through your front foot. Finish all reps, then switch legs.',
  ], ['Most of the weight on the front leg.', 'Front knee tracks over your toes; torso slightly forward is fine.']),
  'kb-bulgarian-split-squat': S('Split_Squat_with_Dumbbells', [
    'Stand a long stride in front of a bench/chair/sofa, rest the top of your back foot on it. Hold the kettlebell at your chest (goblet) or in one hand.',
    'Lower straight down until your back knee nearly touches the floor.',
    'Drive up through your front foot. Finish all reps, then switch legs.',
  ], ['Most of the weight on the front leg.', 'Find your stance before loading it — too short and your knee shoots forward. Photo shows dumbbells.']),
  'db-walking-lunge': I('Dumbbell_Lunges', [
    'Stand tall with a dumbbell in each hand.',
    'Take a long step forward and lower until both knees are around 90°, back knee just above the floor.',
    'Push through the front foot and step straight into the next lunge with the other leg.',
  ], ['Torso upright.', 'Front knee follows your toes, doesn\'t cave in.']),
  'step-up': I('Dumbbell_Step_Ups', [
    'Stand facing a box or step, dumbbells at your sides (optional).',
    'Put one whole foot on the box and drive up through that heel until you stand on top.',
    'Step down slowly with the other foot. Finish all reps, then switch.',
  ], ['The top leg does the work — don\'t push off the bottom foot.', 'Box height: knee around 90° or slightly lower.']),
  'reverse-lunge': S('Dumbbell_Rear_Lunge', [
    'Stand tall, feet hip-width.',
    'Step one foot back and lower until your back knee nearly touches the floor, front shin roughly vertical.',
    'Push through the front heel to return to standing. Alternate legs or finish one side first.',
  ], ['Easier on the knees than a forward lunge.', 'Stay tall; don\'t let the front knee cave in. Photo shows it with dumbbells.']),
  'kb-reverse-lunge': S('Dumbbell_Rear_Lunge', [
    'Hold the kettlebell by the horns against your chest (goblet).',
    'Step one foot back and lower until your back knee nearly touches the floor.',
    'Push through the front heel to return to standing. Alternate legs or finish one side first.',
  ], ['Bell tight to your chest, torso tall.', 'Front shin roughly vertical, knee tracks over your toes. Photo shows it with dumbbells.']),
  'split-squat-bw': I('Split_Squats', [
    'Take a long split stance, feet hip-width apart (not on a tightrope), back heel up.',
    'Lower straight down until your back knee nearly touches the floor.',
    'Push back up through the front foot. Finish all reps, then switch legs.',
  ], ['Feet stay planted — it\'s a static lunge.', 'Straight up and down, torso tall.']),

  // Horizontal push
  'bench-press': I('Barbell_Bench_Press_-_Medium_Grip', [
    'Lie with your eyes under the bar, feet flat, shoulder blades squeezed together and down.',
    'Grip a little wider than shoulders, unrack, and lower the bar to your mid/lower chest.',
    'Press back up and slightly back over your shoulders.',
  ], ['Elbows about 45° from your body, not flared out to 90°.', 'Use safeties or a spotter for heavy sets.']),
  'db-bench-press': I('Dumbbell_Bench_Press', [
    'Sit with the dumbbells on your thighs, lie back and bring them to your chest. Shoulder blades squeezed.',
    'Press the dumbbells up over your chest.',
    'Lower them under control until they\'re level with your chest.',
  ], ['Elbows about 45° from your body.', 'Control the bottom — don\'t bounce.']),
  'incline-db-press': I('Incline_Dumbbell_Press', [
    'Set the bench to 30–45°. Lie back with the dumbbells at your upper chest.',
    'Press up over your upper chest.',
    'Lower under control to chest level.',
  ], ['Shoulder blades pinned to the bench.', 'Low incline (30°) keeps it a chest exercise.']),
  'chest-press-machine': I('Machine_Bench_Press', [
    'Adjust the seat so the handles are at mid-chest height.',
    'Press the handles forward until your arms are almost straight.',
    'Return slowly until you feel a chest stretch.',
  ], ['Back and shoulder blades on the pad.', 'Don\'t lock out hard.']),
  'band-chest-press': S('Standing_Cable_Chest_Press', [
    'Anchor the band behind you at chest height (door anchor or around a post). Hold a handle in each hand, step forward until there is tension.',
    'Staggered stance, press both hands straight forward until your arms are extended.',
    'Return slowly to chest level.',
  ], ['Brace — don\'t let the band pull you backward.', 'Slow return is half the work. Photo shows a cable version.']),
  'kb-floor-press': I('One-Arm_Kettlebell_Floor_Press', [
    'Lie on your back, knees bent. Hold the kettlebell(s) racked: handle in your palm, bell on the outside of your forearm, upper arm on the floor.',
    'Press straight up over your shoulder until your arm is straight.',
    'Lower until your upper arm touches the floor, pause, press again.',
  ], ['Wrist straight, knuckles to the ceiling.', 'The floor stops the range — pause there, don\'t bounce your elbow.']),
  'push-up': I('Pushups', [
    'Hands slightly wider than shoulders, body straight from head to heels.',
    'Lower until your chest is just above the floor, elbows about 45° from your body.',
    'Push the floor away back to the top.',
  ], ['Squeeze glutes and brace — no sagging hips.', 'Too hard? Hands on a bench/table. Too easy? Feet up.']),
  'dip': I('Dips_-_Chest_Version', [
    'Support yourself on parallel bars, arms straight.',
    'Lean slightly forward and lower until your shoulders are just below your elbows.',
    'Press back up to straight arms.',
  ], ['Shoulders down, away from your ears.', 'Stop the depth if your shoulders hurt.']),

  // Vertical push
  'overhead-press': I('Standing_Military_Press', [
    'Bar on the front of your shoulders, hands just outside shoulders, feet hip-width, glutes squeezed.',
    'Press the bar straight up, moving your head back out of the way, then push your head through once the bar passes.',
    'Lock out over your mid-foot, then lower to your shoulders.',
  ], ['Ribs down — don\'t lean back to finish the rep.', 'Bar path is a straight vertical line.']),
  'db-shoulder-press': I('Dumbbell_Shoulder_Press', [
    'Seated or standing, dumbbells at shoulder height, palms forward or facing each other.',
    'Press up until your arms are straight overhead.',
    'Lower under control back to shoulder height.',
  ], ['Don\'t arch your lower back.', 'Elbows slightly in front of your body.']),
  'band-overhead-press': I('Shoulder_Press_-_With_Bands', [
    'Stand on the band, handles at shoulder height.',
    'Press straight up overhead.',
    'Lower slowly back to your shoulders.',
  ], ['Glutes tight, ribs down.', 'Slow lowering keeps tension.']),
  'kb-half-kneeling-press': S('Two-Arm_Kettlebell_Military_Press', [
    'Kneel on one knee (both knees at 90°), kettlebell racked on the side of the down knee.',
    'Squeeze the glute of the down leg and press the bell straight up until your arm is locked out.',
    'Lower back to the rack. Finish all reps, then switch sides.',
  ], ['Kneeling stops you leaning back — stay tall and squeeze that glute.', 'Biceps finishes next to your ear. Photo shows the standing two-bell version.']),
  'pike-push-up': F([
    'Start in a push-up position, then walk your feet in and lift your hips high so your body forms an upside-down V.',
    'Bend your elbows and lower the top of your head toward the floor just in front of your hands.',
    'Press back up to straight arms.',
  ], ['The more vertical your torso, the harder it gets — feet on a box is the next step.', 'Elbows track back, not flared out.']),

  // Horizontal pull
  'barbell-row': I('Bent_Over_Barbell_Row', [
    'Hold the bar, hinge forward to about 45°, knees soft, back flat.',
    'Pull the bar to your lower ribs, squeezing your shoulder blades together.',
    'Lower under control to straight arms.',
  ], ['Torso stays still — no heaving.', 'Lead with your elbows.']),
  'db-row': I('One-Arm_Dumbbell_Row', [
    'One hand and the same-side knee on a bench, other foot on the floor, back flat.',
    'Pull the dumbbell up to your hip, elbow close to your body.',
    'Lower until your arm is straight and you feel a stretch.',
  ], ['Pull to your hip, not your chest.', 'Don\'t twist your torso to lift it.']),
  'kb-row': I('One-Arm_Kettlebell_Row', [
    'Staggered stance (or one hand on a bench/chair), hinge forward with a flat back, bell hanging under your shoulder.',
    'Row the kettlebell to your hip, elbow brushing your side.',
    'Lower slowly to a full stretch. Finish all reps, then switch sides.',
  ], ['Pull to the hip, squeeze the shoulder blade back.', 'Hips and shoulders stay square — no rotating up.']),
  'cable-row': I('Seated_Cable_Rows', [
    'Sit with feet on the platform, knees soft, back tall, arms straight.',
    'Pull the handle to your belly, squeezing your shoulder blades.',
    'Return slowly until your arms are straight and shoulders reach forward slightly.',
  ], ['Torso stays upright — don\'t rock back.', 'Chest up, shoulders down.']),
  'band-row': S('Seated_Cable_Rows', [
    'Anchor the band in front of you at chest height (or loop it around your feet while sitting).',
    'Pull the handles to your belly, elbows close, squeezing your shoulder blades.',
    'Return slowly to straight arms.',
  ], ['Pause and squeeze at the end of each rep.', 'Shoulders down, away from your ears. Photo shows a cable version.']),
  'inverted-row': I('Inverted_Row', [
    'Hang under a bar set at waist height (or a low bar/rings), body straight, heels on the floor.',
    'Pull your chest to the bar, squeezing your shoulder blades.',
    'Lower to straight arms with your body still straight.',
  ], ['Body like a plank — no sagging hips.', 'More upright = easier; feet raised = harder.']),
  'table-row': S('Inverted_Row', [
    'Lie under a sturdy table, grip the edge with both hands, heels on the floor, body straight.',
    'Pull your chest up to the table edge.',
    'Lower slowly to straight arms.',
  ], ['Test the table first — it must not tip.', 'Bend your knees to make it easier. Photo shows a bar version.']),

  // Vertical pull
  'pull-up': I('Pullups', [
    'Hang from the bar, hands just wider than shoulders, palms facing away.',
    'Pull your shoulder blades down, then pull until your chin clears the bar.',
    'Lower all the way to straight arms.',
  ], ['No kipping or swinging.', 'Can\'t do one yet? Do slow negatives or use a band.']),
  'chin-up': I('Chin-Up', [
    'Hang from the bar, hands shoulder-width, palms facing you.',
    'Pull until your chin clears the bar, chest toward the bar.',
    'Lower all the way down under control.',
  ], ['Full hang at the bottom of every rep.', 'Squeeze your glutes to stop swinging.']),
  'lat-pulldown': I('Wide-Grip_Lat_Pulldown', [
    'Sit with thighs under the pad, grip the bar wider than shoulders.',
    'Lean back slightly and pull the bar to your upper chest.',
    'Let it rise slowly until your arms are straight.',
  ], ['Drive your elbows down to your sides.', 'Don\'t yank with your body.']),
  'band-pulldown': S('Close-Grip_Front_Lat_Pulldown', [
    'Anchor the band high (top of a door or a pull-up bar). Kneel or stand, arms extended overhead.',
    'Pull your elbows down to your sides, bringing your hands to your shoulders.',
    'Return slowly.',
  ], ['Shoulder blades down first, then pull.', 'Control the way up. Photo shows a cable version.']),
  'scap-pull-up': I('Scapular_Pull-Up', [
    'Hang from the bar with straight arms.',
    'Without bending your elbows, pull your shoulders down away from your ears — your body rises a few centimetres.',
    'Relax back to a full hang under control.',
  ], ['Arms stay straight — it\'s only the shoulder blades moving.', 'Builds the first part of every pull-up.']),

  // Shoulders / arms
  'lateral-raise': I('Side_Lateral_Raise', [
    'Stand with dumbbells at your sides, slight bend in the elbows.',
    'Raise your arms out to the sides to shoulder height.',
    'Lower slowly.',
  ], ['Lead with your elbows, pinkies not higher than thumbs.', 'Light weight, no swinging.']),
  'band-lateral-raise': I('Lateral_Raise_-_With_Bands', [
    'Stand on the middle of the band, ends in each hand.',
    'Raise your arms out to the sides to shoulder height.',
    'Lower slowly against the band.',
  ], ['Don\'t shrug.', 'Slow on the way down.']),
  'face-pull': I('Face_Pull', [
    'Rope on a cable at head height. Grip with palms facing down/in, step back.',
    'Pull the rope toward your face, splitting the ends and rotating your hands back so your knuckles end beside your ears.',
    'Return slowly.',
  ], ['Elbows high, finish like a double-biceps pose.', 'Light — it\'s for shoulder health.']),
  'band-pull-apart': I('Band_Pull_Apart', [
    'Hold a band in front of you at shoulder height, arms straight, hands shoulder-width.',
    'Pull the band apart by moving your hands out to the sides until it touches your chest.',
    'Return slowly.',
  ], ['Squeeze your shoulder blades together.', 'Don\'t shrug or arch your back.']),
  'prone-ytw': F([
    'Lie face down, forehead on a towel, arms overhead. Thumbs up.',
    'Y: lift your arms in a Y shape a few centimetres off the floor, hold 2 s, lower. T: arms straight out to the sides, lift, hold, lower.',
    'W: elbows bent and tucked toward your ribs, hands out — squeeze your shoulder blades down and together and lift, hold, lower. That\'s 1 rep.',
  ], ['Small lifts, big squeeze — the shoulder blades do the work.', 'Keep your neck long; don\'t look up.']),
  'db-curl': I('Dumbbell_Bicep_Curl', [
    'Stand with dumbbells at your sides, palms forward.',
    'Curl the weights up, elbows pinned at your sides.',
    'Lower slowly to straight arms.',
  ], ['No swinging.', 'Full range — straight arms at the bottom.']),
  'band-curl': S('Standing_Biceps_Cable_Curl', [
    'Stand on the band, handles in your hands, palms forward.',
    'Curl up, elbows pinned at your sides.',
    'Lower slowly.',
  ], ['Squeeze at the top.', 'Elbows don\'t drift forward. Photo shows a cable version.']),
  'kb-hammer-curl': S('Hammer_Curls', [
    'Loop a towel through the kettlebell handle and hold one end in each hand, palms facing each other.',
    'Curl the bell up, elbows pinned at your sides.',
    'Lower slowly to straight arms.',
  ], ['The towel makes your grip work hard — squeeze it.', 'No swinging. Photo shows dumbbell hammer curls.']),
  'triceps-pushdown': I('Triceps_Pushdown', [
    'Face the cable, bar or rope at chest height, elbows tucked at your sides.',
    'Push down until your arms are straight.',
    'Let it rise slowly to about 90° at the elbow.',
  ], ['Elbows stay still at your sides.', 'Lean slightly forward, don\'t use body weight.']),
  'db-overhead-extension': I('Standing_Dumbbell_Triceps_Extension', [
    'Hold one dumbbell overhead with both hands, arms straight.',
    'Lower it behind your head by bending only at the elbows.',
    'Extend back up to straight arms.',
  ], ['Elbows point forward, close to your head.', 'Ribs down, no arching.']),
  'diamond-push-up': I('Push-Ups_-_Close_Triceps_Position', [
    'Push-up position with your hands close together under your chest.',
    'Lower your chest to your hands, elbows tucked along your sides.',
    'Push back up.',
  ], ['Body stays straight.', 'Do them from your knees if needed.']),

  // Calves
  'calf-raise': I('Standing_Dumbbell_Calf_Raise', [
    'Stand on the edge of a step with the balls of your feet, dumbbell in one hand, other hand for balance.',
    'Rise up as high as you can.',
    'Lower slowly until your heels are below the step.',
  ], ['Pause at the top and the bottom.', 'Full range beats heavy weight.']),
  'calf-raise-bw': S('Standing_Dumbbell_Calf_Raise', [
    'Stand on one foot on the edge of a step, hold something for balance.',
    'Rise up as high as you can.',
    'Lower slowly until your heel is below the step. Finish one side, then switch.',
  ], ['Pause at the top and the bottom.', 'Slow lowering, 2–3 s. Photo shows the two-leg version.']),

  // Core
  'hanging-knee-raise': S('Hanging_Leg_Raise', [
    'Hang from a bar with straight arms.',
    'Raise your knees toward your chest, curling your pelvis up.',
    'Lower slowly without swinging.',
  ], ['Curl your pelvis — don\'t just lift your thighs.', 'Stop the swing between reps. Photo shows straight-leg raises (harder).']),
  'dead-bug': I('Dead_Bug', [
    'Lie on your back, arms straight up, knees bent 90° over your hips.',
    'Press your lower back into the floor. Slowly extend one arm overhead and the opposite leg out straight.',
    'Return and switch sides.',
  ], ['Lower back stays pressed down the whole time.', 'Breathe out as you extend.']),
  'ab-wheel': S('Barbell_Ab_Rollout_-_On_Knees', [
    'Kneel and hold the wheel under your shoulders.',
    'Roll forward slowly, keeping your hips in line with your body, as far as you can control.',
    'Pull back to the start using your abs.',
  ], ['Never let your lower back sag.', 'Start with short rollouts. Photo shows a barbell rollout.']),
  'bird-dog': F([
    'On hands and knees, hands under shoulders, knees under hips, back flat.',
    'Reach one arm forward and the opposite leg straight back until both are level with your body.',
    'Hold 2 s, return slowly, switch sides.',
  ], ['Hips stay level — imagine a glass of water on your lower back.', 'Reach long, not high.']),
  'band-hip-flexor-march': S('Hip_Flexion_with_Band', [
    'Loop a band around both feet (no band yet: do it without). Lie on your back with knees bent 90° over your hips, or stand tall.',
    'Drive one knee up/in against the band while the other leg stays put. Hold 1–2 s.',
    'Lower slowly and switch legs.',
  ], ['Lower back stays flat (lying) or torso tall (standing).', 'Slow and controlled. Photo shows the standing banded version.']),
  'plank': I('Plank', [
    'Forearms on the floor, elbows under shoulders, body straight from head to heels.',
    'Squeeze your glutes and brace your abs.',
    'Hold for time, breathing normally.',
  ], ['No sagging hips, no butt in the air.', 'Push the floor away with your forearms.']),
  'side-plank': I('Side_Bridge', [
    'Lie on your side, elbow under your shoulder, feet stacked.',
    'Lift your hips until your body is straight.',
    'Hold, then switch sides.',
  ], ['Hips high, don\'t let them sag.', 'Knees down to make it easier.']),
  'hollow-hold': F([
    'Lie on your back, arms overhead.',
    'Press your lower back into the floor and lift your arms, shoulders and legs a few centimetres off the floor.',
    'Hold that banana shape for time.',
  ], ['Lower back stays glued down — if it lifts, bend your knees or bring your arms in.', 'Breathe shallow, stay tight.']),

  // Carry
  'farmer-carry': I('Farmers_Walk', [
    'Pick up a heavy dumbbell in each hand.',
    'Stand tall, shoulders back, and walk with short quick steps.',
    'Set down with a flat back.',
  ], ['Don\'t lean or let the weights swing.', 'Grip hard.']),
  'kb-carry': S('Farmers_Walk', [
    'Pick up the kettlebell(s): at your side (suitcase), racked at your chest, or overhead.',
    'Stand tall and walk with short steps.',
    'Switch hands halfway on one-sided carries.',
  ], ['One-sided carries: don\'t lean away from the bell.', 'Ribs down, shoulders level. Photo shows a two-handed farmer\'s walk.']),

  // Cardio
  'run': I('Trail_Running_Walking', [
    'Start easy for the first 5 minutes.',
    'Run tall, relaxed shoulders, short quick steps landing under your body.',
    'Keep to the target zone or pace in the session.',
  ], ['Zone 2 = you can still talk in full sentences.', 'Easy days easy, hard days hard.']),
  'treadmill-run': I('Running_Treadmill', [
    'Start walking, then build up to your target speed.',
    'Set 1% incline to mimic running outside.',
    'Keep to the target zone or pace in the session.',
  ], ['Don\'t hold the rails.', 'Short quick steps.']),
  'row-erg': I('Rowing_Stationary', [
    'Strap in. Order on the way out: legs, then lean back, then pull the handle to your lower ribs.',
    'Return in reverse: arms, then lean forward, then bend the knees.',
    'Find a steady rhythm at the target intensity.',
  ], ['About 60% legs, 20% back, 20% arms.', 'Damper 3–5 is enough.']),
  'bike-erg': I('Bicycling_Stationary', [
    'Saddle at hip height: slight knee bend at the bottom of the pedal stroke.',
    'Warm up easy, then ride at the target intensity.',
    'Keep a smooth cadence (80–95 rpm).',
  ], ['Raise the resistance, don\'t mash slowly.', 'Relaxed shoulders.']),
  'ride': I('Bicycling', [
    'Check tyres and brakes, wear a helmet.',
    'Ride at the target intensity; easy gears on hills for Zone 2.',
    'Bring water for anything over an hour.',
  ], ['Zone 2 = conversational.', 'Stay seen.']),
  'hike': I('Trail_Running_Walking', [
    'Walk at a brisk pace — you can talk but you notice your breathing.',
    'Use hills to raise intensity.',
    'Keep to the time or distance in the session.',
  ], ['Brisk, not a stroll.', 'Good shoes, water.']),
  'jump-rope': I('Rope_Jumping', [
    'Rope length: handles reach your armpits when you stand on the middle.',
    'Turn the rope with your wrists, elbows close to your sides.',
    'Small hops on the balls of your feet.',
  ], ['Low jumps — just clear the rope.', 'Stay relaxed.']),
  'burpee': F([
    'From standing, squat down and put your hands on the floor.',
    'Jump your feet back to a plank (add a push-up if you want), then jump your feet back to your hands.',
    'Jump up with your arms overhead.',
  ], ['Land softly.', 'Keep your hips in line in the plank — no sagging.']),

  // Mobility
  'couch-stretch': F([
    'Kneel with your back knee in the corner of a wall/couch and that shin up the wall; other foot flat in front.',
    'Start with your hands on the floor, then slowly bring your torso upright.',
    'Squeeze the glute of the back leg and hold. Switch sides.',
  ], ['Stretch is in the front of the back thigh and hip.', 'Pad the knee. Ease in — this one is intense.']),
  'hip-flexor-stretch': I('Kneeling_Hip_Flexor', [
    'Half-kneel: back knee on the floor, front foot flat, both knees 90°.',
    'Tuck your pelvis under (tailbone down) and squeeze the glute of the back leg.',
    'Shift forward slightly until you feel the stretch at the front of the back hip. Hold, switch sides.',
  ], ['The pelvic tuck matters more than how far you lean.', 'Don\'t arch your lower back.']),
  'pigeon': F([
    'From all fours, bring one knee forward behind your wrist and lay that shin across in front of you.',
    'Slide the other leg straight back, hips square to the floor.',
    'Stay tall or fold forward over the front leg. Hold, switch sides.',
  ], ['Stretch in the glute of the front leg.', 'Knee pain? Put a cushion under your hip or tuck the front foot closer.']),
  'worlds-greatest': I('Worlds_Greatest_Stretch', [
    'Step into a long lunge, back knee down or up.',
    'Put the same-side hand as your front foot on the floor inside it, drop the elbow toward the instep.',
    'Rotate and reach that arm to the ceiling, then back down. Switch sides.',
  ], ['Move slowly, breathe out on each reach.', 'Hits hips, hamstrings and upper back in one move.']),
  'thoracic-rotation': F([
    'On hands and knees, put one hand behind your head.',
    'Rotate that elbow down toward the opposite wrist.',
    'Then rotate it up toward the ceiling as far as you can, following with your eyes. Finish the reps, switch sides.',
  ], ['Rotate through your upper back; hips stay still.', 'Slow, exhale as you open up.']),
  'cat-cow': I('Cat_Stretch', [
    'On hands and knees, hands under shoulders, knees under hips.',
    'Cat: round your back up, tuck your chin and tailbone.',
    'Cow: let your belly drop, lift your chest and tailbone. Flow between them slowly.',
  ], ['Move one vertebra at a time.', 'Breathe out as you round.']),
  'deep-squat-hold': F([
    'Feet shoulder-width, toes slightly out.',
    'Sit down as deep as you can, heels down, chest up. Hold onto something if needed.',
    'Push your knees out with your elbows and hold, breathing slowly.',
  ], ['Heels stay down — put a small plate under them if they lift.', 'Relax into it.']),
  'hamstring-stretch': I('Hamstring_Stretch', [
    'Lie on your back, one leg straight up. Hold behind the thigh or use a strap or towel.',
    'Straighten the knee as much as you can and pull the leg gently toward you.',
    'Hold, switch legs.',
  ], ['Other leg stays flat on the floor.', 'Stretch, not pain.']),
  'dead-hang': S('One_Handed_Hang', [
    'Grab a pull-up bar with both hands, shoulder-width.',
    'Lift your feet and hang with relaxed shoulders and straight arms.',
    'Hold for time, breathing slowly.',
  ], ['Let your shoulders stretch, but stop if anything pinches.', 'Builds grip and decompresses the spine. Photo shows a one-arm hang.']),
  'childs-pose': I('Childs_Pose', [
    'Kneel, big toes together, knees apart.',
    'Sit back on your heels and walk your hands forward, chest toward the floor.',
    'Rest your forehead down and breathe slowly.',
  ], ['Reach your hands far forward for a lat stretch.', 'Relax completely.']),
  'hip-90-90': F([
    'Sit on the floor with both knees bent 90°: front leg turned out in front of you, back leg turned in to the side.',
    'Sit tall, hands behind you for support if needed.',
    'Rotate both knees over to the other side without moving your feet — now the other leg is in front. That\'s one switch.',
  ], ['Slow, controlled rotations; stay as upright as you can.', 'Lean over the front shin for an extra hip stretch.']),
  'leg-swing': F([
    'Stand side-on to a wall, one hand on it for balance.',
    'Swing your outside leg forward and back like a pendulum, gradually higher.',
    'Then face the wall and swing side to side. Switch legs.',
  ], ['Relaxed and rhythmic — dynamic, not a stretch-and-hold.', 'Stand tall, don\'t lean.']),
  'kb-suitcase-march': F([
    'Hold one kettlebell in one hand at your side, arm long, like carrying a suitcase.',
    'Stand tall and march: drive one knee up to hip height, pause, lower it, then the other.',
    'Stay put or walk slowly forward. Do the set, then switch hands for the other side.',
  ], ['Don\'t lean toward or away from the bell — your obliques keep you level.', 'Ribs down, shoulders level, slow and controlled.']),
  'kb-halo': F([
    'Hold the kettlebell upside down by the horns at chest height.',
    'Circle it around your head: past one ear, behind your head, past the other ear, back to your chest.',
    'Alternate directions each rep.',
  ], ['Keep the bell close to your head.', 'Ribs down, glutes tight — only the arms and shoulders move.']),
}

export function exerciseInfo(id) {
  return EXERCISE_INFO[id] || null
}

export function photoUrls(info) {
  if (!info?.photo) return []
  const base = `${import.meta.env.BASE_URL}ex/${info.photo}`
  return [`${base}-0.jpg`, `${base}-1.jpg`]
}

export function videoSearchUrl(name) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise form`)}`
}
