# 🐞 Bug: Placeholder seats render outside the table border

> **Symptoms**
> • Circle & rectangle tables: dashed “+” seats appear scattered below / to the right of the card body.
> • Changing **Edit Seats** count shuffles them, but they **never** line up around the outline.

---

## 📌 Root cause

All seat‐placement formulas use the wrong base coordinates:

| Shape         | Function(s)                                       | What’s wrong                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Circle**    | `createCircleTable` **and** `updateTableSeats`    | • Radius uses the circle’s full half‑width (**100 px**) instead of<br>  `width / 2 − seatRadius` ⇒ every seat centre sits on the border; add the seat’s own 20 px radius and it ends up **outside**. <br>• `+ 10` margin is incorrectly added to `left/top`, shifting everything down/right. |
| **Rectangle** | `createRectangleTable` **and** `updateTableSeats` | • The computed `(x, y)` is a point **on** the rectangle’s border; subtracting only 20 px pushes the seat centre on the edge, so its 40 px body hangs outside. <br>• Extra `+ 10` margin (update path) shifts seats down/right.                                                               |

---

## 🔧 Fix (copy‑paste ready)

👉 Add these constants once (top of **js/canvas.js** and **js/drag‑drop.js** or a shared `helpers.js`):

```js
const SEAT_R = 20; // half of .seat 40 px diameter
```

### 1. Circle tables

Replace in **`createCircleTable`** *and* in the circle branch of **`updateTableSeats`**:

```diff
-const radius = width / 2;          // old
+const radius = width / 2 - SEAT_R; // new: keep centre inside border

-seat.style.left = (centerX + radius * Math.cos(angle) - 20 + 10) + 'px';
-seat.style.top  = (centerY + radius * Math.sin(angle) - 20 + 10) + 'px';
+seat.style.left = (centerX + radius * Math.cos(angle) - SEAT_R) + 'px';
+seat.style.top  = (centerY + radius * Math.sin(angle) - SEAT_R) + 'px';
```

### 2. Rectangle tables

Replace in **`createRectangleTable`** *and* in the rectangle branch of **`updateTableSeats`**:

```diff
-seat.style.left = (x - 20 + 10) + 'px';
-seat.style.top  = (y - 20 + 10) + 'px';
+seat.style.left = (x - SEAT_R) + 'px';
+seat.style.top  = (y - SEAT_R) + 'px';
```

*(No other math changes needed—the `(x, y)` values already traverse the rectangle perimeter correctly.)*

### 3. 💡 Optional refactor

Extract a helper, e.g. `function placeSeat(seat, x, y)`, to avoid duplicating the `‑SEAT_R` logic.

---

## ✅ Acceptance checklist

* [ ] Adding a new **circle** table with 8 seats shows a perfect octagon of `+` seats hugging the border.
* [ ] Adding a new **rectangle** table shows seats evenly spaced around all four edges.
* [ ] Using **Edit Seats** (change to 6 → 8 → 10, etc.) never shifts existing seats off‑border.
* [ ] No `+ 10` magic offsets remain; seat maths uses only `SEAT_R`.
* [ ] Drag‑and‑drop, JSON import/export, and print still function.

---

> **Agent hint:** Only the four snippets above need patching. Run the test matrix after each file save; visual diff will immediately confirm success.
