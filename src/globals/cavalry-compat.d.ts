declare namespace api {
	function get(...args: any[]): any
	function set(...args: any[]): any
	function modifyKeyframe(...args: any[]): any
	function modifyKeyframeTangent(...args: any[]): any
	function setKeyframeVelocity(...args: any[]): any
	function getPreferenceObject(key: string): any
	function getAppAssetsPath(): string
}

declare namespace ui {
	function addMenuItem(menuItem: {
		name: string
		onMouseRelease?: () => void
		enabled?: boolean
		icon?: string
	}): void

	class Modal {
		showStringInput(title: string, message: string, value?: string): string
		showQuestion(title: string, message: string): boolean
		showQuestion(title: string, message: string, value: string): boolean
	}

	function getThemeColor(name: string): string
	function setBackgroundColor(color: string): void
	function setDefaultButton(button: Button): void
	function size(): { width: number; height: number }
	let onKeyPress: (key: any, event?: any) => void
	let onKeyDown: (key: any, event?: any, isDown?: boolean) => void
	let onKeyRelease: (key: any, event?: any) => void
	let onKeyUp: (key: any, event?: any) => void
	let onResize: () => void

	interface Widget {
		onMousePress?: (position: any, button: any) => void
		onMouseMove?: (position: any) => void
		onMouseRelease?: (position?: any, button?: any) => void
		setAutoDefault?(enabled: boolean): void
		setBackgroundColor?(color: string): void
		setDefault?(enabled: boolean): void
		setFixedHeight?(height: number): void
		setFixedWidth?(width: number): void
		setToolTip?(text: string): void
		useHoverEvents?(enabled: boolean): void
		setTransparentForMouseEvents?(enabled: boolean): void
	}

	interface Container extends Widget {}
	interface Draw extends Widget {}
	interface ScrollView {
		onMouseMove?: (position: any) => void
	}
	interface TabView {
		onTabChanged?: (index: number | string) => void
	}
	interface Menu {
		addMenuItem(menuItem: {
			name: string
			onMouseRelease?: () => void
			enabled?: boolean
			icon?: string
		}): void
	}
	interface HLayout {
		add(item: any): void
	}
	interface VLayout {
		add(item: any): void
	}
	interface FlowLayout {
		add(item: any): void
	}

	interface LineEdit {
		getValue(): number
		setValue(value: number): void
	}

	interface NumericField {
		setStep(step: number): void
	}
}
