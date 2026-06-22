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
      { id: "c1", name: "Timothée Chalamet", character: "Paul Atreides", profilePath: "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=200&q=80" },
      { id: "c2", name: "Zendaya", character: "Chani", profilePath: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80" },
      { id: "c3", name: "Rebecca Ferguson", character: "Lady Jessica Atreides", profilePath: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=80" },
      { id: "c4", name: "Austin Butler", character: "Feyd-Rautha Harkonnen", profilePath: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&q=80" }
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
    backdropPath: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=80",
    releaseDate: "2022-03-04",
    voteAverage: 8.1,
    voteCount: 9200,
    runtime: 176,
    genres: ["Action", "Crime", "Drama", "Mystery"],
    director: "Matt Reeves",
    cast: [
      { id: "c31", name: "Robert Pattinson", character: "Bruce Wayne / Batman", profilePath: "https://images.unsplash.com/photo-1474176857210-7287d38d27c6?w=200&q=80" },
      { id: "c32", name: "Zoë Kravitz", character: "Selina Kyle / Catwoman", profilePath: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=200&q=80" },
      { id: "c33", name: "Paul Dano", character: "The Riddler / Edward Nashton", profilePath: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&q=80" },
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
      { id: "c53", name: "Denzel Washington", character: "Macrinus", profilePath: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" },
      { id: "c54", name: "Connie Nielsen", character: "Lucilla", profilePath: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/g6jL299mUks"
  },
  {
    id: "7",
    title: "Inside Out 2",
    tagline: "Make room for new emotions.",
    overview: "Teenager Riley's mind headquarters is undergoing a sudden demolition to make room for something entirely unexpected: new Emotions! Joy, Sadness, Anger, Fear and Disgust, who've long been running a successful operation by all accounts, aren't sure how to feel when Anxiety shows up. And it looks like she's not alone.",
    backdropPath: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1489564239502-7a532064e1c2?w=600&q=80",
    releaseDate: "2024-06-14",
    voteAverage: 8.2,
    voteCount: 3820,
    runtime: 96,
    genres: ["Animation", "Comedy", "Family"],
    director: "Kelsey Mann",
    cast: [
      { id: "c61", name: "Amy Poehler", character: "Joy (voice)", profilePath: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=80" },
      { id: "c62", name: "Maya Hawke", character: "Anxiety (voice)", profilePath: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80" },
      { id: "c63", name: "Phyllis Smith", character: "Sadness (voice)", profilePath: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" },
      { id: "c64", name: "Lewis Black", character: "Anger (voice)", profilePath: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&q=80" }
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
      { id: "c72", name: "Ke Huy Quan", character: "Waymond Wang", profilePath: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80" },
      { id: "c73", name: "Stephanie Hsu", character: "Joy Wang", profilePath: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
      { id: "c74", name: "Jamie Lee Curtis", character: "Deirdre Beaubeirdre", profilePath: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" }
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
      { id: "c81", name: "Bill Skarsgård", character: "Count Orlok", profilePath: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&q=80" },
      { id: "c82", name: "Lily-Rose Depp", character: "Ellen Hutter", profilePath: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=200&q=80" },
      { id: "c83", name: "Nicholas Hoult", character: "Thomas Hutter", profilePath: "https://images.unsplash.com/photo-1474176857210-7287d38d27c6?w=200&q=80" },
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
    posterPath: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&q=80",
    releaseDate: "2024-05-24",
    voteAverage: 7.7,
    voteCount: 2950,
    runtime: 148,
    genres: ["Action", "Sci-Fi", "Adventure"],
    director: "George Miller",
    cast: [
      { id: "c91", name: "Anya Taylor-Joy", character: "Imperator Furiosa", profilePath: "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=200&q=80" },
      { id: "c92", name: "Chris Hemsworth", character: "Warlord Dementus", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c93", name: "Tom Burke", character: "Praetorian Jack", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
      { id: "c94", name: "Lachy Hulme", character: "Immortan Joe / Rizzdale Pell", profilePath: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/XJMuhwVlca4"
  },
  {
    id: "11",
    title: "The Holdovers",
    tagline: "No place to go. No choice but to connect.",
    overview: "A curmudgeonly instructor at a New England prep school is forced to remain on campus over the winter break to babysit the handful of students who have nowhere to go. He soon forms an unlikely bond with one of them—a damaged, but clever boy—as well as the school's head cook, who has just lost a son in Vietnam.",
    backdropPath: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&q=80",
    releaseDate: "2023-10-27",
    voteAverage: 8.0,
    voteCount: 3100,
    runtime: 133,
    genres: ["Comedy", "Drama"],
    director: "Alexander Payne",
    cast: [
      { id: "c101", name: "Paul Giamatti", character: "Paul Hunham", profilePath: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80" },
      { id: "c102", name: "Dominic Sessa", character: "Angus Tully", profilePath: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&q=80" },
      { id: "c103", name: "Da'Vine Joy Randolph", character: "Mary Lamb", profilePath: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80" },
      { id: "c104", name: "Carrie Preston", character: "Lydia Crane", profilePath: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/AhKLpJmHhIg"
  },
  {
    id: "12",
    title: "Past Lives",
    tagline: "What could have been.",
    overview: "Nora and Hae Sung, two deeply connected childhood friends, are separated when Nora's family emigrates from South Korea. Two decades later, they are reunited in New York for one week as they confront notions of love, destiny, and the lives they could have led.",
    backdropPath: "https://images.unsplash.com/photo-1538370965046-79c0d6907d47?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&q=80",
    releaseDate: "2023-06-02",
    voteAverage: 8.0,
    voteCount: 2850,
    runtime: 106,
    genres: ["Romance", "Drama"],
    director: "Celine Song",
    cast: [
      { id: "c111", name: "Greta Lee", character: "Nora Moon", profilePath: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" },
      { id: "c112", name: "Teo Yoo", character: "Hae Sung", profilePath: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80" },
      { id: "c113", name: "John Magaro", character: "Arthur", profilePath: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" },
      { id: "c114", name: "Moon Seung-ah", character: "Young Nora", profilePath: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/kA7-0GFkMHo"
  },
  {
    id: "13",
    title: "Killers of the Flower Moon",
    tagline: "When oil was discovered on their land, the murders began.",
    overview: "Members of the Osage tribe in the United States are murdered under mysterious circumstances in the 1920s, sparking a major FBI investigation involving J. Edgar Hoover.",
    backdropPath: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&q=80",
    releaseDate: "2023-10-20",
    voteAverage: 7.6,
    voteCount: 4500,
    runtime: 206,
    genres: ["Drama", "History", "Mystery", "Thriller"],
    director: "Martin Scorsese",
    cast: [
      { id: "c121", name: "Leonardo DiCaprio", character: "Ernest Burkhart", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c122", name: "Lily Gladstone", character: "Mollie Burkhart", profilePath: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
      { id: "c123", name: "Robert De Niro", character: "William Hale", profilePath: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" },
      { id: "c124", name: "Jesse Plemons", character: "Tom White", profilePath: "https://images.unsplash.com/photo-1474176857210-7287d38d27c6?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/EP34Yoxs3FQ"
  },
  {
    id: "14",
    title: "Wicked",
    tagline: "Everyone deserves the chance to fly.",
    overview: "A young woman Elphaba, ostracized because of her unusual green skin, forms an unlikely friendship with the popular and sheltered Glinda at Shiz University in the Land of Oz. Their friendship is tested as Elphaba discovers a dark secret, and their paths diverge in the run-up to the Wizard's arrival.",
    backdropPath: "https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80",
    releaseDate: "2024-11-22",
    voteAverage: 7.8,
    voteCount: 2300,
    runtime: 160,
    genres: ["Fantasy", "Romance", "Drama", "Family"],
    director: "Jon M. Chu",
    cast: [
      { id: "c131", name: "Cynthia Erivo", character: "Elphaba", profilePath: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=80" },
      { id: "c132", name: "Ariana Grande", character: "Glinda", profilePath: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80" },
      { id: "c133", name: "Jonathan Bailey", character: "Fiyero", profilePath: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&q=80" },
      { id: "c134", name: "Jeff Goldblum", character: "The Wizard", profilePath: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/6COmYeLsz4c"
  },
  {
    id: "15",
    title: "Poor Things",
    tagline: "A woman. Reborn.",
    overview: "Bella Baxter is brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter. Under his protection, she longs to learn. Hungry for the worldliness she is lacking, Bella runs off with Duncan Wedderburn, a debauched lawyer, on a whirlwind adventure across the continents.",
    backdropPath: "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=600&q=80",
    releaseDate: "2023-12-08",
    voteAverage: 8.0,
    voteCount: 3800,
    runtime: 141,
    genres: ["Comedy", "Drama", "Fantasy", "Romance"],
    director: "Yorgos Lanthimos",
    cast: [
      { id: "c141", name: "Emma Stone", character: "Bella Baxter", profilePath: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=200&q=80" },
      { id: "c142", name: "Mark Ruffalo", character: "Duncan Wedderburn", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
      { id: "c143", name: "Willem Dafoe", character: "Dr. Godwin Baxter", profilePath: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&q=80" },
      { id: "c144", name: "Ramy Youssef", character: "Max McCandles", profilePath: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/RlCGSM3DRH8"
  },
  {
    id: "16",
    title: "A Quiet Place: Day One",
    tagline: "Day one. No rules.",
    overview: "As New York City is invaded by alien creatures who hunt by sound, a woman named Sam fights to survive alongside a man she meets on the chaotic streets during the terrifying first day of the invasion.",
    backdropPath: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80",
    releaseDate: "2024-06-28",
    voteAverage: 7.1,
    voteCount: 2100,
    runtime: 99,
    genres: ["Horror", "Sci-Fi", "Thriller"],
    director: "Michael Sarnoski",
    cast: [
      { id: "c151", name: "Lupita Nyong'o", character: "Sam", profilePath: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" },
      { id: "c152", name: "Joseph Quinn", character: "Eric", profilePath: "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=200&q=80" },
      { id: "c153", name: "Alex Wolff", character: "Reuben", profilePath: "https://images.unsplash.com/photo-1474176857210-7287d38d27c6?w=200&q=80" },
      { id: "c154", name: "Djimon Hounsou", character: "Henri", profilePath: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/2YmNBFber5I"
  },
  {
    id: "17",
    title: "Conclave",
    tagline: "The truth has a cost.",
    overview: "One of the world's most powerful and secretive events unfolds after the unexpected death of the Pope leaves the Catholic Church in turmoil. Cardinal Lawrence is tasked with running the conclave that will choose a new Pope, and soon finds himself at the center of a conspiracy that could shake the foundations of the Church.",
    backdropPath: "https://images.unsplash.com/photo-1560523159-4a9692d222ef?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=600&q=80",
    releaseDate: "2024-10-25",
    voteAverage: 7.5,
    voteCount: 1750,
    runtime: 120,
    genres: ["Thriller", "Mystery", "Drama"],
    director: "Edward Berger",
    cast: [
      { id: "c161", name: "Ralph Fiennes", character: "Cardinal Lawrence", profilePath: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80" },
      { id: "c162", name: "Stanley Tucci", character: "Cardinal Bellini", profilePath: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" },
      { id: "c163", name: "John Lithgow", character: "Cardinal Tremblay", profilePath: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&q=80" },
      { id: "c164", name: "Isabella Rossellini", character: "Sister Agnes", profilePath: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/wjdLRMnDWJA"
  },
  {
    id: "18",
    title: "Moana 2",
    tagline: "The ocean calls her back.",
    overview: "After receiving an unexpected call from her wayfinding ancestors, Moana must journey to the far seas of Oceania and into dangerous, long-lost waters for an adventure unlike anything she has ever faced.",
    backdropPath: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=80",
    releaseDate: "2024-11-27",
    voteAverage: 7.0,
    voteCount: 2600,
    runtime: 100,
    genres: ["Animation", "Adventure", "Family", "Comedy"],
    director: "David Derrick Jr.",
    cast: [
      { id: "c171", name: "Auli'i Cravalho", character: "Moana (voice)", profilePath: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80" },
      { id: "c172", name: "Dwayne Johnson", character: "Maui (voice)", profilePath: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
      { id: "c173", name: "Alan Tudyk", character: "Tamatoa (voice)", profilePath: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&q=80" },
      { id: "c174", name: "Hualālai Chung", character: "Moni (voice)", profilePath: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/LBMDFtdZqns"
  },
  {
    id: "19",
    title: "Alien: Romulus",
    tagline: "Do not open.",
    overview: "A group of young space colonizers come face to face with the most terrifying life form in the universe while scavenging the deep ends of a derelict space station.",
    backdropPath: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=600&q=80",
    releaseDate: "2024-08-16",
    voteAverage: 7.3,
    voteCount: 3200,
    runtime: 119,
    genres: ["Horror", "Sci-Fi", "Thriller"],
    director: "Fede Álvarez",
    cast: [
      { id: "c181", name: "Cailee Spaeny", character: "Rain Carradine", profilePath: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=80" },
      { id: "c182", name: "David Jonsson", character: "Andy", profilePath: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" },
      { id: "c183", name: "Archie Renaux", character: "Tyler", profilePath: "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=200&q=80" },
      { id: "c184", name: "Isabela Merced", character: "Kay", profilePath: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/LPpFsDpONjY"
  },
  {
    id: "20",
    title: "Twisters",
    tagline: "Chase the storm. Or it will chase you.",
    overview: "A young woman who survived a devastating tornado encounter in her youth returns to Oklahoma to test a new experimental storm-disruption system. She soon finds herself embedded with a reckless social-media tornado chaser who has a thrill for getting close to nature's most extreme phenomena.",
    backdropPath: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=1600&q=80",
    posterPath: "https://images.unsplash.com/photo-1504608524841-42584120d693?w=600&q=80",
    releaseDate: "2024-07-19",
    voteAverage: 7.2,
    voteCount: 2800,
    runtime: 122,
    genres: ["Action", "Adventure", "Thriller"],
    director: "Lee Isaac Chung",
    cast: [
      { id: "c191", name: "Daisy Edgar-Jones", character: "Kate Cooper", profilePath: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
      { id: "c192", name: "Glen Powell", character: "Tyler Owens", profilePath: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
      { id: "c193", name: "Anthony Ramos", character: "Javi", profilePath: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80" },
      { id: "c194", name: "Maura Tierney", character: "Jo Carter", profilePath: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" }
    ],
    trailerUrl: "https://www.youtube.com/embed/Lp_iqZMuCDk"
  }
];

export const ALL_GENRES = [
  "All",
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller"
];