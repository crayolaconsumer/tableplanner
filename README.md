
# Wedding Table Plan Creator

A user‐friendly web application that helps you plan your wedding seating arrangement with **real-time collaboration** support. Create circle or rectangle tables, specify the number of seats, manage guest names (with CSV import or manual addition), and drag/drop them into seats.

## ✨ New: Real-time Collaboration

**Work together with your fiancé on the same seating plan simultaneously!**

- **Live Updates**: Changes sync instantly between all users
- **No Login Required**: Just share the URL
- **User Presence**: See how many people are currently editing
- **Free Setup**: Uses Firebase's generous free tier
- **Mobile Friendly**: Works on phones and tablets

### Quick Start:
1. Click **"Start Collaboration"** button
2. Share the URL with your fiancé
3. Both can edit simultaneously
4. Changes appear in real-time

*See `firebase-setup.md` for detailed setup instructions.*

When a seat is occupied, it shows a short label (e.g. an icon or initials) to keep the interface clean. For full occupant details (e.g., editing or removing a guest), open the seat’s assignment modal.

## Features

- **Real-time Collaboration**  
  - Work together with your fiancé simultaneously
  - Live updates sync instantly between all users
  - No login required - just share the URL
  - See how many people are currently editing

- **Zoom & Pan Canvas**  
  - Scroll the mouse wheel on the table plan area to zoom in or out.  
  - Click and drag on any empty part of the plan to pan around.

- **Create & Edit Tables**  
  - Create circle or rectangle tables, each with a configurable number of seats.  
  - Change the seat count anytime; any extra seated guests are automatically unassigned.  
  - Remove a table (returns its seated guests to the Unassigned list).

- **Unassigned People**  
  - Add new guests manually or import a CSV file (one name per line).  
  - Search bar for filtering by name in the unassigned list.  
  - Drag & drop guests from the left panel into seats (or back).

- **Assignment Modal**  
  - Click on any seat to open a modal with an unassigned guest list.  
  - Clear the seat’s occupant with the “Clear Seat” button.

- **Random Assignment**  
  - Automatically fill as many free seats as there are unassigned guests, choosing guests at random.

- **Export/Import State**  
  - Export the entire plan (tables and guest assignments) to JSON.  
  - Import that JSON file later to restore all data.

- **Print**  
  - Generate a basic human‐readable list of all tables, seat indexes, and occupant names.

## Getting Started

1. **Clone/Download** this repository.  
2. **Open `index.html`** in your web browser (no server needed).  
3. **Add Tables**: Click “New Table,” pick circle or rectangle, enter a name and seat count.  
4. **Add Guests**:  
   - Use the “Add guest” form on the left panel.  
   - Or import a CSV file (one name per line, or names in the first column).  
5. **Assign Guests**:  
   - Drag a guest from “Unassigned People” onto a seat.  
   - Or click a seat to open the assignment modal and pick a guest.  
   - If a seat is filled, dragging another guest onto it unassigns the old occupant.

## Usage

- **Zoom**: Hover over the table plan and scroll your mouse wheel (1.05 scale factor per tick).  
- **Pan**: Click and drag on empty space in the plan to move around.  
- **Edit Tables**:  
  - “Rename” updates a table’s name.  
  - “Edit Seats” changes seat count. Guests above the new seat count return to “Unassigned People.”  
  - “Remove” deletes the table. Occupants become unassigned.  
- **Print**: Click “Print Plan” to open a simple page listing all tables and seat assignments.  

## CSV Import Format

A basic CSV with **one guest name per line** (or first column) is enough:

```
Alice
Bob
Charlie
```

## Technical Details

- **No server required**: Open `index.html` locally.  
- **Bootstrap 5**: Used for modals, layout, and some styling.  
- **DOM-based**: Data is kept in the DOM; any changes are ephemeral unless you export JSON.  

## Customization

- **Styling**: Tweak the inline `<style>` in `index.html` or add a separate CSS file.  
- **Seat Behavior**: Edit the `.seat` class for different shapes/sizes.  
- **Zoom Factor**: Adjust the `zoomFactor` in the `wheel` event handler.  
- **Initials vs. Icon**: Currently, seats display a short occupant label. Adapt as needed (e.g. show full name, or store occupant data in a popover tooltip).

## Contributing

1. **Fork** this repo.  
2. **Create a branch** for your feature (`git checkout -b feature/myFeature`).  
3. **Commit & push** (`git commit -am 'Add new feature'`, then `git push`).  
4. **Open a Pull Request** to merge into the main branch.

## License

This project is free for personal and commercial use. Feel free to add your own license if you want to make it explicitly open-source. Enjoy customizing and improving the Wedding Table Plan Creator!

---
