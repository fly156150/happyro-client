import { renderDescriptionMarkup } from './DescriptionMarkup.js';
/** Shared read-only skill detail for the skills and shortcut menus. */
export function createSkillDescription(skill) {
 const content = document.createElement('div');
 content.className = 'inventory-item-description';
 const title = document.createElement('h3');
 title.textContent = skill.name;
 const summary = document.createElement('p');
 summary.textContent = `${skill.kind} · 等级 ${skill.level}/${skill.max}`;
 const requirements = document.createElement('p');
 requirements.textContent = `前置技能：${skill.requirements.join('；') || '无'}${skill.reason ? '\n' + skill.reason : ''}`;
 const description = document.createElement('p');
 description.className = 'item-description';
 renderDescriptionMarkup(description, skill.descriptionMarkup || skill.description, { navigation: true });
 content.append(title, summary, requirements, description);
 return content;
}
