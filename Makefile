.PHONY: setup dev build test lint typecheck e2e

setup:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

e2e:
	npm run test:browser
