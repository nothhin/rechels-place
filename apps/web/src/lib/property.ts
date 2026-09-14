export const propertyProfile = {
  displayName: "Rechel's Place",
  shortName: "Rechel's Place",
  descriptor: "Staycation · Condo Rental",
  tagline: "Comfort. Convenience. Cebu.",
  locationLabel: "Banilad, Cebu City",
  address: "Deca Homes Tower 1, Banilad, Cebu City, Cebu 6000",
  timezone: "Asia/Manila",
  currency: "PHP",
  defaultLanguage: "en",
  phoneDisplay: "Contact through Facebook",
  phoneHref: "",
  email: "",
  facebookUrl: "https://www.facebook.com/profile.php?id=61590480065421",
  messengerUrl: "https://m.me/61590480065421",
  airbnbUrl: "https://www.airbnb.com/l/Am7QTase",
  agodaLabel: "Search Rechel's Place on Agoda",
  bookingConfigured: false,
} as const;

export const galleryImages = [
  { src: "/images/uppadar-hollie/master-bedroom.jpg", alt: "Master bedroom with queen-size spring mattress and LED vanity mirror" },
  { src: "/images/uppadar-hollie/bunk-bedroom.jpg", alt: "Second bedroom with double-size bunk bed and built-in steps" },
  { src: "/images/uppadar-hollie/second-bedroom-bunk-wide.png", alt: "Wide view of the second bedroom with double-size bunk beds, wardrobe, and storage" },
  { src: "/images/uppadar-hollie/living-dining-area.png", alt: "Open-plan Rechel's Place living room and dining area with smart TV" },
  { src: "/images/uppadar-hollie/living-dining-overview.png", alt: "Rechel's Place dining table, lounge seating, and decorative shelving" },
  { src: "/images/uppadar-hollie/entertainment-wall-tv.png", alt: "55-inch smart HDTV and warm wood entertainment wall" },
  { src: "/images/uppadar-hollie/bathroom-vanity.png", alt: "Clean Rechel's Place comfort room with illuminated vanity mirror" },
  { src: "/images/uppadar-hollie/dining-table.png", alt: "Dining table set for four guests inside Rechel's Place" },
  { src: "/images/uppadar-hollie/building.jpg", alt: "Deca Homes Tower 1 building courtyard" },
  { src: "/images/uppadar-hollie/hero.jpg", alt: "Rechel's Place living room with illuminated feature wall" },
  { src: "/images/uppadar-hollie/living-room.jpg", alt: "Cozy Rechel's Place lounge with a 55-inch HDTV" },
  { src: "/images/uppadar-hollie/kitchen.jpg", alt: "Guest kitchen and breakfast counter" },
  { src: "/images/uppadar-hollie/kitchen-wide.jpg", alt: "Bright kitchen with refrigerator, appliances, and counter seating" },
  { src: "/images/uppadar-hollie/lounge.jpg", alt: "Warm open-plan living room and kitchen" },
  { src: "/images/uppadar-hollie/kitchen-breakfast-counter.png", alt: "Rechel's Place kitchen with breakfast counter and pendant lights" },
  { src: "/images/uppadar-hollie/dining-shelf-table.png", alt: "Dining table and decorative display shelving" },
  { src: "/images/uppadar-hollie/bathroom-vanity-shower.png", alt: "Bathroom vanity and glass shower enclosure" },
  { src: "/images/uppadar-hollie/bathroom-hot-shower.png", alt: "Bathroom hot-water shower with rain shower head" },
  { src: "/images/uppadar-hollie/complimentary-coffee.png", alt: "Complimentary coffee sachets and cups" },
  { src: "/images/uppadar-hollie/building-corridor.png", alt: "Urban Deca Homes Tower 1 hallway" },
  { src: "/images/uppadar-hollie/building-courtyard.png", alt: "Urban Deca Homes Tower 1 courtyard and parking area" },
  { src: "/images/uppadar-hollie/living-kitchen-evening.png", alt: "Warm evening view of the Rechel's Place living room and kitchen" },
] as const;

export const galleryVideos = [
  { src: "https://www.facebook.com/reel/1470105691108786", label: "Watch the first property tour on Facebook" },
  { src: "https://www.facebook.com/reel/1368641938467034", label: "Watch the second property tour on Facebook" },
] as const;

export const amenityHighlights = [
  ["2", "Comfortable bedrooms"],
  ["Fast", "Wi-Fi connection"],
  ["Smart", "Self check-in"],
  ["5/5", "Recommended on Facebook"],
] as const;

export const stayHighlights = [
  { title: "A true home base", copy: "A fully furnished two-bedroom condo designed for family vacations, friend groups, and business trips in Cebu." },
  { title: "Cook, connect, unwind", copy: "Prepare meals in the kitchen, stay online with Wi-Fi, and relax with the 55-inch HDTV." },
  { title: "Easy city access", copy: "Stay at Deca Homes Tower 1 near Oakridge Business Park, restaurants, cafés, shopping, and major business hubs." },
] as const;

export const amenityGroups = [
  {
    title: "Bedroom and laundry",
    icon: "bed",
    items: [
      { name: "Essentials", detail: "Towels, bed sheets, soap, and toilet paper" },
      { name: "Hangers" },
      { name: "Bed linens" },
      { name: "Room-darkening shades" },
      { name: "Iron" },
      { name: "Ironing table" },
      { name: "Hair blower" },
      { name: "Hair iron" },
      { name: "Clothing storage" },
    ],
  },
  { title: "Entertainment", icon: "tv", items: [{ name: "55-inch HDTV" }, { name: "HBO Max" }] },
  { title: "Heating and cooling", icon: "sparkles", items: [{ name: "Air conditioning" }, { name: "Tower fan" }, { name: "Emergency generator", detail: "Backup power in case of a brownout" }] },
  { title: "Home safety", icon: "check", items: [{ name: "Smoke alarm" }, { name: "Exterior doorbell camera" }, { name: "Smart lock with built-in safety camera" }, { name: "Emergency stair exit in case of an earthquake or other natural disaster" }] },
  { title: "Internet and office", icon: "wifi", items: [{ name: "Wi-Fi" }, { name: "Dedicated workspace" }] },
  {
    title: "Kitchen and dining",
    icon: "kitchen",
    items: [{ name: "Kitchen", detail: "Space where guests can cook their own meals" }, { name: "Range hood" }, { name: "Microwave" }, { name: "Electric kettle" }, { name: "Hot and cold water" }, { name: "Complimentary welcome items", detail: "2 bottled waters, coffee, and sugar" }],
  },
  { title: "Location features", icon: "pin", items: [{ name: "Laundromat nearby" }] },
  { title: "Services", icon: "lock", items: [{ name: "Self check-in" }, { name: "Smart lock" }, { name: "Hot and cold shower" }, { name: "24-hour customer service" }, { name: "24-hour maintenance service" }, { name: "Housekeeping" }] },
] as const;

export const unavailableAmenities = [
  "Washer",
  "Dryer",
  "Carbon monoxide alarm",
  "Heating",
] as const;

export const buildingAmenities = [
  "Deca Homes Tower 1",
  "Secure smart-lock access",
  "Convenient Banilad location",
  "Near restaurants, cafés, shopping centers, and business hubs",
] as const;

export const houseRules = [
  "House rules and guest limits will be confirmed before launch.",
  "Message the page for current policies and reservation requirements.",
] as const;

export const checkoutRules = [
  "Follow the host's checkout instructions",
  "Secure the unit before leaving",
  "Return access items as instructed",
] as const;

export const stayDetails = {
  checkIn: "2:00 PM",
  checkOut: "11:00 AM",
  reminders: [
    "Turn off all lights and air conditioning before leaving, except the refrigerator.",
    "Leave the smart-lock keycard and RFID card inside the unit and securely lock the door.",
  ],
} as const;

export const serviceContacts = [
  { label: "Customer service", name: "Jevie / Barbie", phone: "09426701701" },
  { label: "Housekeeping", name: "Jen", phone: "09974455343" },
  { label: "Maintenance", name: "Tim", phone: "09126680231" },
] as const;

export const nearbyPlaces = [
  "Minutes from Oakridge Business Park",
  "Near restaurants, cafés, and shopping centers",
  "Convenient access to Cebu's major business hubs",
] as const;
