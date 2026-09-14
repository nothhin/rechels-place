export const propertyLogoSrc = "/images/rechel-s-place/rechels-place-logo.png" as const;

export const propertyProfile = {
  displayName: "Rechel's Place CDO",
  shortName: "Rechel's Place",
  descriptor: "Entire condo in Cagayan de Oro, Philippines",
  tagline: "Your home away from home in CDO awaits.",
  locationLabel: "Cagayan de Oro, Philippines",
  address: "1229 Avida Aspira Tower 1, Cagayan de Oro, Philippines 9000",
  timezone: "Asia/Manila",
  currency: "PHP",
  defaultLanguage: "en",
  phoneDisplay: "(043) 109 8599",
  phoneHref: "+63431098599",
  email: "rechel1977@hotmail.com",
  facebookUrl: "https://www.facebook.com/profile.php?id=61573549143343",
  messengerUrl: "https://m.me/61573549143343",
  airbnbUrl: "https://www.airbnb.com/rooms/641471953080650447",
  ratingLabel: "4.95 / 5",
  reviewCount: 75,
  maxGuests: 6,
  bedLabel: "5 beds",
  bathroomLabel: "2.5 baths",
  wifiLabel: "31 Mbps Wi-Fi",
  floorLabel: "12th floor",
  hostName: "Rechel",
  hostResponseLabel: "100% response rate · within an hour",
  bookingConfigured: false,
} as const;

export const galleryImages = [
  { src: "/images/rechel-s-place/listing-01.webp", alt: "Living room with sofa, TV, dining area, and city view", label: "THE LIVING ROOM", title: "Room to settle in." },
  { src: "/images/rechel-s-place/listing-13.webp", alt: "Living room looking toward the dining area and city-facing windows", label: "CITY-FACING WINDOWS", title: "Light from every angle." },
  { src: "/images/rechel-s-place/listing-06.webp", alt: "Open dining area beside the kitchen", label: "DINING AREA", title: "Make room for everyone." },
  { src: "/images/rechel-s-place/listing-16.webp", alt: "Bedroom with a bed beside a bright city view", label: "PRIMARY BEDROOM", title: "Wake up to the city." },
  { src: "/images/rechel-s-place/listing-20.webp", alt: "Bedroom with a wide window and city skyline view", label: "A ROOM WITH A VIEW", title: "Slow mornings, higher up." },
  { src: "/images/rechel-s-place/listing-04.webp", alt: "Primary bedroom prepared with a queen bed and folded towels", label: "PRIMARY BEDROOM", title: "Ready for a restful night." },
  { src: "/images/rechel-s-place/listing-05.webp", alt: "Second bedroom with a bunk bed and storage", label: "SECOND BEDROOM", title: "Flexible sleeping space." },
  { src: "/images/rechel-s-place/listing-10.webp", alt: "Guest kitchen with induction stove and counter space", label: "THE KITCHEN", title: "Cook at your own pace." },
  { src: "/images/rechel-s-place/listing-09.webp", alt: "Dining table set beside the open kitchen", label: "SHARED MOMENTS", title: "Meals are better together." },
  { src: "/images/rechel-s-place/listing-21.webp", alt: "Open-plan kitchen and dining area with natural light", label: "OPEN-PLAN LIVING", title: "Connected without feeling crowded." },
  { src: "/images/rechel-s-place/listing-26.webp", alt: "Condo building and shared swimming pool viewed from above", label: "THE BUILDING", title: "A city stay with a pool." },
  { src: "/images/rechel-s-place/listing-29.webp", alt: "Dining room and kitchen viewed from the living area", label: "THE WHOLE HOME", title: "Settle in together." },
] as const;

export const heroImages = [
  galleryImages[0],
  galleryImages[1],
  galleryImages[2],
  galleryImages[3],
  galleryImages[4],
  galleryImages[6],
  galleryImages[7],
  galleryImages[10],
] as const;

export const galleryVideo = {
  src: "/images/rechel-s-place/rechel-place-tour.mp4",
  poster: "/images/rechel-s-place/airbnb-living-room.webp",
  alt: "Video walkthrough of Rechel's Place entire condo",
} as const;

export const galleryLinks = [
  { href: propertyProfile.airbnbUrl, label: "View more photos on Airbnb" },
  { href: propertyProfile.facebookUrl, label: "See updates on Facebook" },
] as const;

export const amenityHighlights = [
  ["2", "Bedrooms"],
  ["6", "Guests maximum"],
  ["31", "Mbps Wi-Fi"],
  ["4.95/5", "Airbnb rating"],
] as const;

export const stayHighlights = [
  {
    title: "A true home base",
    copy: "Stay in a private two-bedroom condo in Cagayan de Oro, with city, bay, and surrounding-hills views from the 12th floor.",
  },
  {
    title: "Cook, connect, unwind",
    copy: "Use the open-plan kitchen and dining area, work online with verified 31 Mbps Wi-Fi, and unwind with a 65-inch HDTV and Bluetooth sound system.",
  },
  {
    title: "Walkable and well connected",
    copy: "Coffee shops, food, malls, the Pelaez sporting complex, and the on-site gym are close by, with Amaya within a half-hour drive.",
  },
] as const;

export const amenityGroups = [
  {
    title: "Scenic views",
    icon: "map",
    items: [
      { name: "Bay view" },
      { name: "City skyline view" },
      { name: "Mountain view" },
      { name: "Valley view" },
    ],
  },
  {
    title: "Bathroom",
    icon: "shower",
    items: [
      { name: "Cleaning products" },
      { name: "Shampoo" },
      { name: "Conditioner" },
      { name: "Safeguard body soap" },
      { name: "Hot water" },
    ],
  },
  {
    title: "Bedroom and laundry",
    icon: "bed",
    items: [
      { name: "Free washer – In unit" },
      { name: "Free dryer – In unit" },
    ],
  },
  {
    title: "Essentials",
    icon: "bed",
    items: [
      { name: "Towels, bed sheets, soap, and toilet paper" },
      { name: "Hangers" },
      { name: "Bed linens" },
      { name: "Room-darkening shades" },
      { name: "Iron" },
      { name: "Drying rack for clothing" },
      { name: "Clothing storage" },
    ],
  },
  {
    title: "Entertainment",
    icon: "tv",
    items: [
      { name: "65 inch HDTV with Netflix" },
      { name: "Bluetooth sound system" },
    ],
  },
  {
    title: "Exercise equipment",
    icon: "sparkles",
    items: [{ name: "Exercise equipment" }],
  },
  {
    title: "Heating and cooling",
    icon: "snow",
    items: [
      { name: "Window AC unit" },
      { name: "Indoor fireplace" },
    ],
  },
  {
    title: "Home safety",
    icon: "lock",
    items: [
      { name: "Smoke alarm" },
      { name: "Fire extinguisher" },
      { name: "First aid kit" },
    ],
  },
  {
    title: "Internet and office",
    icon: "wifi",
    items: [
      { name: "Wi-Fi – 31 Mbps", detail: "Verified by speed test. Stream 4K videos and join video calls." },
      { name: "Dedicated workspace", detail: "In a common space" },
    ],
  },
  {
    title: "Kitchen and dining",
    icon: "kitchen",
    items: [
      { name: "Kitchen", detail: "Space where guests can cook their own meals" },
      { name: "Refrigerator" },
      { name: "Microwave" },
      { name: "Cooking basics", detail: "Pots and pans, oil, salt and pepper" },
      { name: "Dishes and silverware", detail: "Bowls, chopsticks, plates, cups, etc." },
      { name: "Mini fridge" },
      { name: "Freezer" },
      { name: "Induction stove" },
      { name: "Hot water kettle" },
      { name: "Coffee maker: drip coffee maker" },
      { name: "Wine glasses" },
      { name: "Toaster" },
      { name: "Rice maker" },
      { name: "Dining table" },
    ],
  },
  {
    title: "Location features",
    icon: "pin",
    items: [{ name: "Laundromat nearby" }],
  },
  {
    title: "Parking and facilities",
    icon: "home",
    items: [
      { name: "Free street parking" },
      { name: "Shared pool", detail: "Available all year · open from 7:00 AM to 9:00 PM" },
      { name: "Elevator", detail: "At least 52 inches deep with a doorway at least 32 inches wide" },
      { name: "Shared gym in building" },
    ],
  },
  {
    title: "Services",
    icon: "lock",
    items: [
      { name: "Long term stays allowed", detail: "Stay for 28 days or more" },
      { name: "Self check-in", detail: "Keypad · check yourself into the home with a door code" },
      { name: "Cleaning available during stay" },
    ],
  },
] as const;

export const unavailableAmenities = [
  { name: "Exterior security cameras on property", detail: "Unavailable at this property." },
  { name: "Carbon monoxide alarm", detail: "This place may not have a carbon monoxide detector. Reach out to the host with any questions." },
  { name: "Heating", detail: "Unavailable at this property." },
] as const;

export const reviewSummary = {
  rating: "4.95",
  ratingLabel: "Rated 4.95 out of 5 from 75 reviews.",
  guestFavoriteTitle: "Guest favorite",
  guestFavoriteCopy: "This home is in the top 10% of eligible listings based on ratings, reviews, and reliability.",
  ratingDistribution: [
    { label: "5 stars", percentage: 95 },
    { label: "4 stars", percentage: 5 },
    { label: "3 stars", percentage: 0 },
    { label: "2 stars", percentage: 0 },
    { label: "1 star", percentage: 0 },
  ],
  categoryRatings: [
    { label: "Cleanliness", score: "4.9" },
    { label: "Accuracy", score: "5.0" },
    { label: "Check-in", score: "5.0" },
    { label: "Communication", score: "5.0" },
    { label: "Location", score: "4.9" },
    { label: "Value", score: "4.9" },
  ],
  mentionedTopics: [
    { label: "Cleanliness", count: 30 },
    { label: "Comfort", count: 22 },
    { label: "Hospitality", count: 45 },
    { label: "View", count: 13 },
    { label: "Location", count: 24 },
    { label: "Nearby", count: 13 },
    { label: "Indoor spaces", count: 9 },
    { label: "Family", count: 14 },
    { label: "Check-in", count: 8 },
    { label: "Amenities", count: 5 },
  ],
} as const;

export const guestReviews = [
  {
    author: "Amethyst",
    tenure: "10 years on Airbnb",
    date: "2 weeks ago",
    context: "Repeat stay",
    quote: "This is always our go-to Airbnb whenever we’re in CDO! We keep coming back every time, and we’ll definitely be staying here again. Thank you, Miss Rechel, for the complimentary food and for consistently keeping the place clean, cozy, and welcoming.",
  },
  {
    author: "Vincent",
    tenure: "9 years on Airbnb",
    date: "July 2026",
    context: "Family stay",
    quote: "We absolutely loved our stay! It was super clean and felt like home as soon as we walked in. Every unit amenity worked as expected and provided what was essential to making the trip comfortable. The hosts were super flexible and helpful while we stayed.",
  },
  {
    author: "Amethyst",
    tenure: "10 years on Airbnb",
    date: "June 2026",
    context: "Repeat stay",
    quote: "We stayed at Miss Rechel’s place again, and it was just as wonderful as our first stay. The place was spotless, and we really appreciated the complimentary snacks and fresh fruits. Miss Rechel was also very easy to communicate with and made sure everything was ready.",
  },
  {
    author: "Jaysen",
    tenure: "4 years on Airbnb",
    date: "July 2026",
    context: "Guest stay",
    quote: "Complete amenities. Great place.",
  },
  {
    author: "Christine",
    tenure: "9 years on Airbnb",
    date: "June 2026",
    context: "Group trip",
    quote: "Booked this place for our church group. They had a smooth, hassle-free, and comfortable stay. The location is the best part—it’s walkable to our conference venue, so there was no parking stress and no need for transportation.",
  },
  {
    author: "Amethyst",
    tenure: "10 years on Airbnb",
    date: "May 2026",
    context: "Repeat stay",
    quote: "Miss Rechel’s place is truly a gem in CDO. It’s rare to find an Airbnb that is so well-maintained, exceptionally clean, and smells wonderfully fresh. The beds were incredibly comfortable, the linens felt soft and cozy, and the welcome fruits and snacks were a lovely touch.",
  },
] as const;

export const buildingAmenities = [
  "Avida Aspira Tower 1",
  "Shared pool · open 7:00 AM to 9:00 PM",
  "Shared gym in building",
  "Elevator access",
  "Free street parking",
  "12th-floor city and bay views",
] as const;

export const houseRules = [
  "Check-in after 2:00 PM",
  "Checkout before 11:00 AM",
  "Maximum of 6 guests",
  "Pets are not allowed",
] as const;

export const checkoutRules = [
  "Follow the host's checkout instructions",
  "Secure the condo before leaving",
  "Return access items as instructed",
] as const;

export const stayDetails = {
  checkIn: "2:00 PM",
  checkOut: "11:00 AM",
  reminders: [
    "Self check-in is available with a keypad.",
    "Ask Rechel for current arrival instructions and building access details before your stay.",
  ],
} as const;

export const serviceContacts = [
  { label: "Host", name: "Rechel", phone: propertyProfile.phoneHref },
] as const;

export const nearbyPlaces = [
  "Coffee shops, food, and malls within walking distance",
  "Pelaez sporting complex, track, basketball, tennis, and an on-site gym nearby",
  "Amaya is within a half-hour drive",
] as const;
