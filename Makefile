all: moslack.xpi

FILES := \
	install.rdf \
	bootstrap.js \
	chrome.manifest \
	*.jsm \
	${NULL}

moslack.xpi: ${FILES}
	-rm -f $@
	@zip $@ $^

install.rdf: install.rdf.rb
	ruby $< > $@

clean:
	rm -f moslack.xpi install.rdf

# Use in combination with the extension auto-installer extension
install: moslack.xpi
	curl $(if V,--verbose) --header Expect: --data-binary @$< http://localhost:8888/

.PHONY: clean install
