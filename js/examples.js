/* GameLISP
 * Example games
 */

const BUILTIN_GAMES = {
  pong: `\
# pong
# by Pedro B.

(import game)

(let x_ball 320)
(let x_ball_speed -1)

(let y_ball 240)
(let y_ball_speed 1)

(let y_enemy 200)
(let y_player 200)

(let points_player 0)
(let points_enemy 0)

(let cooldown 160)
(let done false)

(fun update () (
  # Game over?
  (if done (
    (return)
  ))

  # Player movement
  (if (and (> y_player 0) (is_key_pressed "KeyW")) (
    (-= y_player 1)
    (-= y_enemy 1)
  ))
  (if (and (< y_player 416) (is_key_pressed "KeyS")) (
    (+= y_player 1)
    (+= y_enemy 1)
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
    (if (>= points_enemy 5) (
      (= done true)
    ))

    (= x_ball 320)
    (= y_ball 240)
    (= x_ball_speed 1.0)
    (return)
  ))

  # Ball scored on opponent?
  (if (> x_ball 628) (
    (= cooldown 160)
    (+= points_player 1)
    (if (>= points_player 5) (
      (= done true)
    ))

    (= x_ball 320)
    (= y_ball 240)
    (= x_ball_speed -1.0)
    (return)
  ))

  # Player paddle hit ball?
  (if (and (> x_ball 28) (and (< x_ball 48) (and (> y_ball y_player) (< y_ball (+ y_player 64))))) (
    (= x_ball_speed 1)
  ))

  # Opponent paddle hit ball?
  (if (and (< x_ball 608) (and (> x_ball 580) (and (> y_ball y_enemy) (< y_ball (+ y_enemy 64))))) (
    (= x_ball_speed -1)
  ))

  (+= x_ball x_ball_speed)
  (+= y_ball y_ball_speed)
))

(fun draw () (
  (draw_rect x_ball y_ball 12 12)
  (draw_rect 32 y_player 16 64)
  (draw_rect 592 y_enemy 16 64)
))`,
};
