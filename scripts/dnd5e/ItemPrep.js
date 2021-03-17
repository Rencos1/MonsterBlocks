import MonsterBlock5e from "./MonsterBlock5e.js";
import Helpers from "./Helpers5e.js";
import AttackPreper from "./AttackPreper.js";
import CastingPreper from "./CastingPreper.js";
import ResourcePreper from "./ResourcePreper.js";

export default class ItemPrep {
	constructor(sheet, data) {
		this.sheet = sheet;
		this.data = data;

		this._prepareItems(data);
	}
	
	_prepareItems(data) {
		

		// Categorize Items as Features and Spells
		/**
		 * @typedef Feature
		 * @property {typeof ItemPreper}    prep
		 * @property {Function} filter
		 * @property {string}   label
		 * @property {Array}    items
		 * @property {object}   dataset
		 *//**
		 * @type {Object.<string, Feature>}
		 */
		const features = {
			legResist:	{ prep: this.prepFeature.bind(this), filter: MonsterBlock5e.isLegendaryResistance, label: game.i18n.localize("MOBLOKS5E.LegendaryResistance"), items: [] , dataset: {type: "feat"} },
			legendary:	{ prep: this.prepAction.bind(this), filter: MonsterBlock5e.isLegendaryAction, label: game.i18n.localize("DND5E.LegAct"), items: [] , dataset: {type: "feat"} },
			lair:		{ prep: this.prepAction.bind(this), filter: MonsterBlock5e.isLairAction, label: game.i18n.localize("MOBLOKS5E.LairActionsHeading"), items: [] , dataset: {type: "feat"} },
			multiattack:{ prep: this.prepAction.bind(this), filter: MonsterBlock5e.isMultiAttack, label: game.i18n.localize("MOBLOKS5E.Multiattack"), items: [] , dataset: {type: "feat"} },
			casting:	{ prep: CastingPreper, filter: CastingPreper.isCasting.bind(CastingPreper), label: game.i18n.localize("DND5E.Features"), items: [], dataset: {type: "feat"} },
			reaction:	{ prep: this.prepAction.bind(this), filter: MonsterBlock5e.isReaction, label: game.i18n.localize("MOBLOKS5E.Reactions"), items: [], dataset: {type: "feat"} },
			attacks:	{ prep: AttackPreper, filter: item => item.type === "weapon", label: game.i18n.localize("DND5E.AttackPl"), items: [] , dataset: {type: "weapon"} },
			actions:	{ prep: this.prepAction.bind(this), filter: item => Boolean(item.data?.activation?.type), label: game.i18n.localize("DND5E.ActionPl"), items: [] , dataset: {type: "feat"} },
			features:	{ prep: this.prepFeature.bind(this), filter: item => item.type === "feat", label: game.i18n.localize("DND5E.Features"), items: [], dataset: {type: "feat"} },
			equipment:	{ prep: this.prepEquipment.bind(this), filter: () => true, label: game.i18n.localize("DND5E.Inventory"), items: [], dataset: {type: "loot"}}
		};

		// Start by classifying items into groups for rendering
		let [spells, other] = data.items.reduce((arr, item) => {
			if ( item.type === "spell" ) arr[0].push(item);
			else arr[1].push(item);
			return arr;
		}, [[], []]);

		// Apply item filters
		spells = this.sheet._filterItems(spells, this.sheet._filters.spellbook);
		other = this.sheet._filterItems(other, this.sheet._filters.features);

		// Organize Spellbook
		data.spellbook = this.sheet._prepareSpellbook(data, spells);
		data.innateSpellbook = this.prepareInnateSpellbook(data.spellbook); 

		// Organize Features
		for ( let item of other ) {
			let category = Object.values(features).find(cat => cat.filter(item));
			
			//category.prep(item, data);
			this.prepareItem(category, item, data);
			category.items.push(item);
		}

		// Assign and return
		data.features = features;
	}

	prepareInnateSpellbook(spellbook) { // We need to completely re-organize the spellbook for an innate spellcaster
		let innateSpellbook = [];

		for (let level of spellbook) {								// Spellbook is seperated into sections based on level, though all the innate spells are lumped together, we still want to check all the sections.
			if (level.prop !== "innate") continue;					// We don't care about sections that aren't marked as innate though
			for (let spell of level.spells) {						// Check all the spells
				let uses = spell.data.uses.max;						// The max uses are the only thing actually displayed, though the data tracks usage
																	// Max uses is what we are going to end up sorting the spellbook by.
				let finder = e => e.uses == uses;					// The conditional expression for later. We are going to check if our new spellbook has a section for this spells usage amount.
				
				if (!innateSpellbook.some(finder)) {				// Array.some() is used to check the whole array to see if the condition is ever satisfied.
					innateSpellbook.push({							// If there isn't a section to put this spell into, we create a new one.
						canCreate: false,							// Most of this is just intended to match the data in the regular spell book, though most isn't ultimately going to be used.
						canPrepare: false,
						dataset: { level: -10, type: "spell" },
						label: uses < 1 ? "At will" : (uses + "/day"),	// This is important, as this string will be used to display on the sheet.
						order: -10,
						override: 0,
						prop: "innate",
						slots: "-",
						spells: [],									// An empty array to put spells in later.
						uses: uses,									// How we will identify this type of spell later, rather than by spell level.
						usesSlots: false
					});
				}
				
				spell.resource = new ResourcePreper(spell, this.sheet.object.items.get(spell._id)).getResource();
				innateSpellbook.find(finder).spells.push(spell);	// We can use the same condition as above, this time to lacate the item that satisfies the condition. We then insert the current spell into that section.
			}
		}
		innateSpellbook.sort((a, b) => {	// This sorts the spellbook sections, so that the first section is the "0" useage one, which is actually infinite uses - At will, and Cantrips.
			if (a.uses == 0 && b.uses == 0) return 0;
			if (a.uses == 0) return -1;
			if (b.uses == 0) return 1;
			
			return a.uses < b.uses ? 1 : -1;
		});
		
		return innateSpellbook;
	}

	/**
	 *
	 *
	 * @param {Feature} category
	 * @param {*} item
	 * @param {*} data
	 * @return {*} 
	 * @memberof ItemPrep
	 */
	prepareItem(category, item, data) {
		if (!(category.prep == AttackPreper || category.prep == CastingPreper)) {
			category.prep(item, data);
			return;
		}

		const preparer = new category.prep(this.sheet, item, data);
		preparer.prepResources();
		preparer.prepare();
	}
	prepFeature(featureData) {
		let feature = this.sheet.object.items.get(featureData._id);

		//this.prepResources(featureData, feature)
	}
	prepAction(actionData) {
		let action = this.sheet.object.items.get(actionData._id);
			
		//this.prepResources(actionData, action);
		
		actionData.is = { 
			multiAttaack: MonsterBlock5e.isMultiAttack(action.data),
			legendary: MonsterBlock5e.isLegendaryAction(action.data),
			lair: MonsterBlock5e.isLairAction(action.data),
			legResist: MonsterBlock5e.isLegendaryResistance(action.data),
			reaction: MonsterBlock5e.isReaction(action.data)
		};
		actionData.is.specialAction = Object.values(actionData.is).some(v => v == true);	// Used to ensure that actions that need seperated out aren't shown twice
	}
	

	prepEquipment(equipData) {
		let item = this.sheet.object.items.get(equipData._id);

		//this.prepResources(equipData, item);
	}

	getMultiattack(data) { // The Multiattack action is always first in the list, so we need to find it and seperate it out.
		for (let item of data.items) {
			if (MonsterBlock5e.isMultiAttack(item)) return item;
		}
		return false;
	}
	getLegendaryResistance(data) {
		for (let item of data.items) {
			if (MonsterBlock5e.isLegendaryResistance(item)) return item;
		}
		return false;
	}

	/**
	 *
	 *
	 * @param {boolean} success - Whether or not the roll was a success.
	 * @param {Event} event - The event object associated with this roll.
	 * @memberof MonsterBlock5e
	 */
	async setCharged(success, event) {
		await this.sheet.actor.updateEmbeddedEntity("OwnedItem", {
			_id: event.currentTarget.dataset.itemId,
			"data.recharge.charged": success
		})

		super._onChangeInput(event);
	}
	
}