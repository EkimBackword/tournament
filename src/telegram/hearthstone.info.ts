export const DECK_CLASSES = [
    { id: 'Druid', title: 'Друид'},
    { id: 'Mage', title: 'Маг'},
    { id: 'Paladin', title: 'Паладин'},
    { id: 'Priest', title: 'Жрец'},
    { id: 'Rogue', title: 'Разбойник'},
    { id: 'Shaman', title: 'Шаман'},
    { id: 'Warlock', title: 'Чернокнижник'},
    { id: 'Warrior', title: 'Воин'},
    { id: 'Hunter', title: 'Охотник'},
];

export const getRuName = (id: string) => {
    const deck = DECK_CLASSES.find(d => d.id === id);
    if (deck) {
        return deck.title;
    }
    return '<Не известный класс героя>';
};
