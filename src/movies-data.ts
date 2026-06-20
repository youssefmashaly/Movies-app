import { Movie } from "./types";

export const PRESET_MOVIES: Movie[] = [
  {
    id: "1",
    title: "Dune: Part Two",
    tagline: "Long live the fighters.",
    overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the universe, he endeavors to prevent a terrible future only he can foresee.",
    backdropPath: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1547483238-f400e65ccd56?w=600&q=80",
    releaseDate: "2024-03-01",
    voteAverage: 8.8,
    voteCount: 4210,
    runtime: 166,
    genres: ["Sci-Fi", "Adventure", "Action"],
    director: "Denis Villeneuve",
    cast: [
      { id: "c1", name: "Timothée Chalamet", character: "Paul Atreides", profilePath: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" },
      { id: "c2", name: "Zendaya", character: "Chani", profilePath: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
      { id: "c3", name: "Rebecca Ferguson", character: "Lady Jessica Atreides", profilePath: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80" },
      { id: "c4", name: "Austin Butler", character: "Feyd-Rautha Harkonnen", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/Way9Dexny3w"
  },
  {
    id: "2",
    title: "Oppenheimer",
    tagline: "The world forever changes.",
    overview: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II, which ushered in the atomic age.",
    backdropPath: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600&q=80",
    releaseDate: "2023-07-21",
    voteAverage: 8.9,
    voteCount: 8430,
    runtime: 180,
    genres: ["Drama", "History", "Biography"],
    director: "Christopher Nolan",
    cast: [
      { id: "c11", name: "Cillian Murphy", character: "J. Robert Oppenheimer", profilePath: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" },
      { id: "c12", name: "Emily Blunt", character: "Kitty Oppenheimer", profilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
      { id: "c13", name: "Matt Damon", character: "Leslie Groves", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c14", name: "Robert Downey Jr.", character: "Lewis Strauss", profilePath: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg"
  },
  {
    id: "3",
    title: "Spider-Man: Across the Spider-Verse",
    tagline: "It's how you wear the mask.",
    overview: "After reuniting with Gwen Stacy, Brooklyn's full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence. However, when the heroes clash on how to handle a new threat, Miles must redefine what it means to be a hero.",
    backdropPath: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=600&q=80",
    releaseDate: "2023-06-02",
    voteAverage: 9.0,
    voteCount: 6150,
    runtime: 140,
    genres: ["Animation", "Action", "Sci-Fi", "Adventure"],
    director: "Joaquim Dos Santos",
    cast: [
      { id: "c21", name: "Shameik Moore", character: "Miles Morales / Spider-Man", profilePath: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=200&q=80" },
      { id: "c22", name: "Hailee Steinfeld", character: "Gwen Stacy / Spider-Woman", profilePath: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80" },
      { id: "c23", name: "Oscar Isaac", character: "Miguel O'Hara / Spider-Man 2099", profilePath: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80" },
      { id: "c24", name: "Jake Johnson", character: "Peter B. Parker / Spider-Man", profilePath: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/shW9i6k8cB0"
  },
  {
    id: "4",
    title: "The Batman",
    tagline: "Unmask the truth.",
    overview: "In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.",
    backdropPath: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80",
    releaseDate: "2022-03-04",
    voteAverage: 8.1,
    voteCount: 9200,
    runtime: 176,
    genres: ["Action", "Crime", "Drama", "Mystery"],
    director: "Matt Reeves",
    cast: [
      { id: "c31", name: "Robert Pattinson", character: "Bruce Wayne / Batman", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c32", name: "Zoë Kravitz", character: "Selina Kyle / Catwoman", profilePath: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
      { id: "c33", name: "Paul Dano", character: "The Riddler / Edward Nashton", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
      { id: "c34", name: "Colin Farrell", character: "The Penguin / Oswald Cobblepot", profilePath: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/mqq_H30YrKI"
  },
  {
    id: "5",
    title: "Interstellar",
    tagline: "Mankind was born on Earth. It was never meant to die here.",
    overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
    backdropPath: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1454789548928-9efd52dc4031?w=600&q=80",
    releaseDate: "2014-11-07",
    voteAverage: 8.7,
    voteCount: 34200,
    runtime: 169,
    genres: ["Sci-Fi", "Drama", "Adventure"],
    director: "Christopher Nolan",
    cast: [
      { id: "c41", name: "Matthew McConaughey", character: "Cooper", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c42", name: "Anne Hathaway", character: "Brand", profilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
      { id: "c43", name: "Jessica Chastain", character: "Murph", profilePath: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80" },
      { id: "c44", name: "Michael Caine", character: "Professor Brand", profilePath: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/zSWdZVtXT7E"
  },
  {
    id: "6",
    title: "Gladiator II",
    tagline: "Shadows and dust.",
    overview: "Over two decades after the death of the legendary hero Maximus, Lucius—the son of Maximus's love Lucilla—finds himself forced to enter the Colosseum after his home is conquered by the tyrannical emperors who now lead Rome with an iron fist.",
    backdropPath: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1508847154043-be12a3bab469?w=600&q=80",
    releaseDate: "2024-11-22",
    voteAverage: 7.2,
    voteCount: 1890,
    runtime: 148,
    genres: ["Action", "Drama", "History"],
    director: "Ridley Scott",
    cast: [
      { id: "c51", name: "Paul Mescal", character: "Lucius Verus", profilePath: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" },
      { id: "c52", name: "Pedro Pascal", character: "Marcus Acacius", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
      { id: "c53", name: "Denzel Washington", character: "Macrinus", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c54", name: "Connie Nielsen", character: "Lucilla", profilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/g6jL299mUks"
  },
  {
    id: "7",
    title: "Inside Out 2",
    tagline: "Make room for new emotions.",
    overview: "Teenager Riley's mind headquarters is undergoing a sudden demolition to make room for something entirely unexpected: new Emotions! Joy, Sadness, Anger, Fear and Disgust, who’ve long been running a successful operation by all accounts, aren’t sure how to feel when Anxiety shows up. And it looks like she’s not alone.",
    backdropPath: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1489564239502-7a532064e1c2?w=600&q=80",
    releaseDate: "2024-06-14",
    voteAverage: 8.2,
    voteCount: 3820,
    runtime: 96,
    genres: ["Animation", "Comedy", "Family"],
    director: "Kelsey Mann",
    cast: [
      { id: "c61", name: "Amy Poehler", character: "Joy (voice)", profilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
      { id: "c62", name: "Maya Hawke", character: "Anxiety (voice)", profilePath: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80" },
      { id: "c63", name: "Phyllis Smith", character: "Sadness (voice)", profilePath: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80" },
      { id: "c64", name: "Lewis Black", character: "Anger (voice)", profilePath: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/LEjhYCCgOis"
  },
  {
    id: "8",
    title: "Everything Everywhere All at Once",
    tagline: "The universe is so much bigger than you realize.",
    overview: "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save the world by exploring other universes connecting with the lives she could have led.",
    backdropPath: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1569074187119-c87815b476da?w=600&q=80",
    releaseDate: "2022-03-24",
    voteAverage: 8.5,
    voteCount: 6540,
    runtime: 139,
    genres: ["Action", "Sci-Fi", "Comedy", "Adventure"],
    director: "Daniel Kwan, Daniel Scheinert",
    cast: [
      { id: "c71", name: "Michelle Yeoh", character: "Evelyn Wang", profilePath: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" },
      { id: "c72", name: "Ke Huy Quan", character: "Waymond Wang", profilePath: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" },
      { id: "c73", name: "Stephanie Hsu", character: "Joy Wang", profilePath: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
      { id: "c74", name: "Jamie Lee Curtis", character: "Deirdre Beaubeirdre", profilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/wxN1T1uxQ2g"
  },
  {
    id: "9",
    title: "Nosferatu",
    tagline: "An obsession born in darkness.",
    overview: "A gothic tale of obsession between a haunted young woman in 19th century Germany and the ancient Transylvanian vampire who stalks her, bringing untold horror in his wake.",
    backdropPath: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=600&q=80",
    releaseDate: "2024-12-25",
    voteAverage: 7.8,
    voteCount: 1400,
    runtime: 132,
    genres: ["Horror", "Fantasy", "Drama"],
    director: "Robert Eggers",
    cast: [
      { id: "c81", name: "Bill Skarsgård", character: "Count Orlok", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c82", name: "Lily-Rose Depp", character: "Ellen Hutter", profilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
      { id: "c83", name: "Nicholas Hoult", character: "Thomas Hutter", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
      { id: "c84", name: "Willem Dafoe", character: "Professor Albin Eberhart Von Franz", profilePath: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/t9Z9W6d_a_U"
  },
  {
    id: "10",
    title: "Furiosa: A Mad Max Saga",
    tagline: "Outrun your past.",
    overview: "As the world fell, young Furiosa is snatched from the Green Place of Many Mothers and falls into the hands of a great Biker Horde led by the Warlord Dementus. Sweeping through the Wasteland, they come across the Citadel presided over by The Immortan Joe. As the two Tyrants war for dominance, Furiosa must survive many trials as she plots her way home.",
    backdropPath: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&q=80",
    releaseDate: "2024-05-24",
    voteAverage: 7.7,
    voteCount: 2950,
    runtime: 148,
    genres: ["Action", "Sci-Fi", "Adventure"],
    director: "George Miller",
    cast: [
      { id: "c91", name: "Anya Taylor-Joy", character: "Imperator Furiosa", profilePath: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" },
      { id: "c92", name: "Chris Hemsworth", character: "Warlord Dementus", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c93", name: "Tom Burke", character: "Praetorian Jack", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
      { id: "c94", name: "Lachy Hulme", character: "Immortan Joe / Rizzdale Pell", profilePath: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/XJMuhwVlca4"
  }
];

export const ALL_GENRES = [
  "All",
  "Action",
  "Adventure",
  "Sci-Fi",
  "Drama",
  "History",
  "Biography",
  "Animation",
  "Crime",
  "Mystery",
  "Horror",
  "Fantasy",
  "Comedy",
  "Family"
];
