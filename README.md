Wedding Table Plan Creator
A user‐friendly web application that helps you plan your wedding seating arrangement. Create circle or rectangle tables, specify the number of seats, manage guest names (with CSV import or manual addition), and drag/drop them into seats.

When a seat is occupied, you see the occupant’s short label (e.g. “AG”) or small icon to keep the interface visually clean. For more details (full name, edit/remove buttons), open the seat’s assignment modal.

Features
Zoom & Pan Canvas

Scroll the mouse wheel on the table plan area to zoom in or out.
Click and drag on any empty canvas area to pan.
Create & Edit Tables

Support for circle or rectangle tables.
Specify how many seats each table has.
Change the number of seats at any time—already‐assigned guests in seats that “disappear” are moved back to the Unassigned People list.
Unassigned People

Add new guests manually or import from a CSV (simple one‐column format).
Search bar to filter by name.
Drag guests from the unassigned panel into any table seat (or back from a seat to unassigned).
Assignment Modal

Click any seat to open an assignment modal, where you can pick a guest from the unassigned list.
Clear a seat’s occupant using the “Clear Seat” button.
Random Assignment

Optionally fill all available seats with unassigned guests at random, for quick drafting or “inspiration.”
Export/Import State

Export your entire plan (tables & assigned/unassigned guests) to a JSON file.
Later import that file to restore the state.
Print

Generates a human‐readable seating list (table names, seat indices, occupant names) in a new window, which you can then print or save as PDF.
Getting Started
Clone or Download this repository.
Open index.html in your browser (no server required for basic usage).
Add Tables: Click “New Table” → Enter table name, choose circle or rectangle, specify seat count.
Add Guests:
Use the small “Add guest” form (left panel).
Or click “Choose file” to import a CSV with guest names (one per line).
Assign Guests:
Drag a guest from “Unassigned People” onto any seat.
Or open a seat’s assignment modal and choose a guest from the list.
Usage
Zoom: Move the mouse pointer over the table plan area and scroll your mouse wheel.
Pan: Click and drag on an empty area of the plan.
Drag & Drop:
Drag from the left “Unassigned People” panel to a seat (or from a seat back to “Unassigned People”).
If a seat is already filled, that occupant is automatically unassigned.
Editing a Table:
“Rename” changes the table name.
“Edit Seats” changes how many seats the table has; guests over the new seat limit are returned to “Unassigned People.”
“Remove” deletes the table (all seated guests are moved to “Unassigned People”).
CSV Import Format
A simple CSV with one guest name per line in the first column is sufficient.
Example:
nginx
Copy
Edit
Alice
Bob
Carol
How It Works
People
Each unassigned person is a draggable “card” with optional edit/remove buttons.
Seats
Each seat is a small circle. When a seat is filled, it turns green and displays the occupant’s short label (or an icon).
Random Assign
Automatically seats as many unassigned guests as there are free seats.
Technical Details
Pure HTML, CSS, and JavaScript, plus Bootstrap 5 for styling and modals.
No build process required; simply open index.html in your browser.
All data is stored in the DOM; no server or database needed.
Customization
Styling: Tweak index.html’s <style> section or override with your own CSS file.
Zoom Behavior: Adjust the zoomFactor in tablePlanEl.addEventListener('wheel', ...).
Seat Appearance: Change .seat in CSS for different shapes, sizes, or occupant display.
Popover Approach: If you prefer to display occupant details in a popover (rather than a seat modal), see the Bootstrap Popover docs for examples.
Contributing
Fork this repository.
Create a feature branch (git checkout -b new-feature).
Commit your changes (git commit -am 'Add new feature').
Push to the branch (git push origin new-feature).
Create a Pull Request.
License
This project is free for personal and commercial use. No specific license is enforced, but you are welcome to add an open‐source license of your choice to encourage collaboration.
