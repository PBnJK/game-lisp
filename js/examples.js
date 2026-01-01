/* GameLISP
 * Example games
 */

const BUILTIN_GAMES = {
  pong: `\
# PONG
# by Pedro B.
#
# HOW TO PLAY:
#   1. Control your paddle with W and S
#   2. Hit ball into opponents side to receive points
#   3. First to 5 wins
#
# HACK ME!
#   1. Is the ball too fast? Change the SPEED!
#   2. Is the enemy too dumb? Tweak its logic!
#   3. Is 5 points too little? Make it 1000!

(import game)

(let SPEED 2)
(let POINTS_TO_WIN 5)

(let x_ball 320)
(let x_ball_speed (- SPEED))

(let y_ball 240)
(let y_ball_speed SPEED)

(let y_enemy 200)
(let y_player 200)

(let points_player 0)
(let points_enemy 0)

(let cooldown 160)
(let done false)
(let win_str "")

(set_font_size 32)

(fun update () (
  # Game over?
  (if done (
    (return)
  ))

  # Player movement
  (if (and (> y_player 0) (is_key_pressed "KeyW")) (
    (-= y_player 1)
  ))
  (if (and (< y_player 416) (is_key_pressed "KeyS")) (
    (+= y_player 1)
  ))

  # Enemy movement
  (if (and (== y_ball_speed SPEED) (> x_ball 400)) (
    (if (and (< y_enemy 416) (> y_ball y_enemy)) (
      (+= y_enemy 1)
    ) (
      (if (and (> y_enemy 0) (< y_ball (+ y_enemy 64))) (
        (-= y_enemy 1)
      ))
    ))
  ))

  # In cooldown?
  (if (> cooldown 0) (
    (-= cooldown 1)
    (return)
  ))

  # Limit ball vertically
  (if (or (> y_ball 468) (< y_ball 0)) (
    (= y_ball_speed (- y_ball_speed))
  ))

  # Ball scored on player?
  (if (< x_ball 0) (
    (= cooldown 160)
    (+= points_enemy 1)
    (if (>= points_enemy POINTS_TO_WIN) (
      (= done true)
      (= win_str "computer won!")
    ))

    (= x_ball 320)
    (= y_ball 240)
    (= x_ball_speed SPEED)
    (return)
  ))

  # Ball scored on opponent?
  (if (> x_ball 628) (
    (= cooldown 160)
    (+= points_player 1)
    (if (>= points_player POINTS_TO_WIN) (
      (= done true)
      (= win_str "player won!")
    ))

    (= x_ball 320)
    (= y_ball 240)
    (= x_ball_speed (- SPEED))
    (return)
  ))

  # Player paddle hit ball?
  (if (and (> x_ball 28) (and (< x_ball 48) (and (>= y_ball y_player) (<= y_ball (+ y_player 64))))) (
    (= x_ball_speed SPEED)
  ))

  # Opponent paddle hit ball?
  (if (and (< x_ball 608) (and (> x_ball 580) (and (>= y_ball y_enemy) (<= y_ball (+ y_enemy 64))))) (
    (= x_ball_speed (- SPEED))
  ))

  (+= x_ball x_ball_speed)
  (+= y_ball y_ball_speed)
))

(fun draw () (
  (draw_rect x_ball y_ball 12 12)
  (draw_rect 32 y_player 16 64)
  (draw_rect 592 y_enemy 16 64)
  (if done (
    (draw_text 240 128 win_str)
  ) (
    (draw_text 272 64 points_player)
    (draw_text 336 64 points_enemy)
  ))
))`,
};
