import { validateSocialText } from 'Utils/SocialText.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
export function allowSocialText(fields) {
	const error = validateSocialText(fields);
	if (!error) return true;
	ChatBox.addText(error, ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
	return false;
}
